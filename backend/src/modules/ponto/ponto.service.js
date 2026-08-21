const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { calcularApontamentoDoDia } = require('./calculoJornada');
const bancoHorasService = require('./bancoHoras.service');
const { horaLocalParaUTC } = require('../../utils/tempo');
const notificacoesService = require('../responsaveis/notificacoes.service');
const { caminhoAbsoluto } = require('../dispositivos/fotoStorage');

const FUSO_PADRAO = 'America/Sao_Paulo';

/**
 * `data` chega como uma string "YYYY-MM-DD" (o dia calendario que se quer
 * processar) ou, de chamadas programaticas, um Date. Extrai ano/mes/dia
 * diretamente dos componentes - NUNCA via `new Date(string)` seguido de
 * reinterpretacao em outro fuso, porque "2026-07-20" vira meia-noite UTC,
 * que já é 19/07 no horário de Brasília: reinterpretar isso no fuso da
 * empresa devolveria o dia errado.
 */
function extrairAnoMesDia(data) {
  if (typeof data === 'string') {
    const [ano, mes, dia] = data.split('-').map(Number);
    return { ano, mes, dia };
  }
  return { ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1, dia: data.getUTCDate() };
}

const TIPO_BATIDA_POR_CODIGO = {
  0: 'entrada',
  1: 'saida',
  2: 'entrada_intervalo',
  3: 'saida_intervalo',
};

function normalizarTipoBatida(codigoBruto) {
  return TIPO_BATIDA_POR_CODIGO[codigoBruto] || 'indefinido';
}

/**
 * Recebe os registros ja lidos do dispositivo (via adapter) e persiste em
 * registros_ponto, resolvendo o funcionario correspondente quando possivel.
 * Idempotente: reexecutar com os mesmos registros nao duplica nada, gracas
 * ao indice unico (dispositivo_id, nsr).
 */
async function ingerirRegistros(empresaId, dispositivo, registros) {
  if (!registros || registros.length === 0) {
    await db('dispositivos')
      .where({ id: dispositivo.id })
      .update({ ultima_coleta_em: db.fn.now(), ultima_coleta_status: 'sucesso_sem_novidades' });
    return { totalRecebidos: 0, totalNovos: 0, totalNaoResolvidos: 0 };
  }

  // O mesmo ID interno do dispositivo resolve para EXATAMENTE UM tipo de
  // pessoa (funcionario ou aluno) - o equipamento nao sabe nem precisa saber
  // essa diferenca, ele so relata "usuario X bateu ponto"; quem decide qual
  // cadastro esse X pertence e aqui (por isso duas consultas, uma tabela de
  // vinculo por tipo, sem duplicar o resto do pipeline de coleta).
  const [vinculosFuncionarios, vinculosAlunos] = await Promise.all([
    db('funcionario_dispositivos').where({ dispositivo_id: dispositivo.id }),
    db('aluno_dispositivos').where({ dispositivo_id: dispositivo.id }),
  ]);
  const mapaFuncionarioPorIdDispositivo = new Map(vinculosFuncionarios.map((v) => [v.id_no_dispositivo, v.funcionario_id]));
  const mapaAlunoPorIdDispositivo = new Map(vinculosAlunos.map((v) => [v.id_no_dispositivo, v.aluno_id]));

  let totalNovos = 0;
  let totalNaoResolvidos = 0;
  let maiorNsr = dispositivo.ultimo_nsr || 0;
  const novasBatidasDeAluno = []; // notificadas DEPOIS do commit, nunca dentro da transacao

  await db.transaction(async (trx) => {
    for (const registro of registros) {
      const funcionarioId = mapaFuncionarioPorIdDispositivo.get(registro.idNoDispositivo) || null;
      const alunoId = funcionarioId ? null : mapaAlunoPorIdDispositivo.get(registro.idNoDispositivo) || null;
      const resolvido = Boolean(funcionarioId || alunoId);
      if (!resolvido) totalNaoResolvidos += 1;

      const [inserido] = await trx('registros_ponto')
        .insert({
          empresa_id: empresaId,
          dispositivo_id: dispositivo.id,
          funcionario_id: funcionarioId,
          aluno_id: alunoId,
          nsr: registro.nsr,
          data_hora: registro.dataHora,
          tipo_verificacao_bruto: registro.tipoVerificacaoBruto,
          tipo_batida: normalizarTipoBatida(registro.tipoVerificacaoBruto),
          origem: 'dispositivo',
          id_bruto_nao_resolvido: resolvido ? null : registro.idNoDispositivo,
          // Nem toda origem de registro preenche isso (o protocolo ZK, por
          // exemplo, nunca manda foto nem payload bruto) - por isso o
          // `|| null` em vez de deixar `undefined` ir pro insert.
          foto_url: registro.fotoUrl || null,
          payload_bruto: registro.payloadBruto ? JSON.stringify(registro.payloadBruto) : null,
        })
        .onConflict(['dispositivo_id', 'nsr'])
        .ignore()
        .returning('id');

      if (inserido) {
        totalNovos += 1;
        if (alunoId) novasBatidasDeAluno.push({ alunoId, dataHora: registro.dataHora });
      }
      if (registro.nsr > maiorNsr) maiorNsr = registro.nsr;
    }

    await trx('dispositivos').where({ id: dispositivo.id }).update({
      ultimo_nsr: maiorNsr,
      ultima_coleta_em: trx.fn.now(),
      ultima_coleta_status: 'sucesso',
    });
  });

  if (novasBatidasDeAluno.length > 0) {
    const filial = dispositivo.filial_id ? await db('filiais').where({ id: dispositivo.filial_id }).first() : null;
    const timeZone = (filial && filial.fuso_horario) || dispositivo.fuso_horario || FUSO_PADRAO;

    // Fire-and-forget deliberado: falha ao notificar (rede instavel, token
    // invalido) nunca deve fazer a coleta em si parecer ter falhado.
    Promise.all(
      novasBatidasDeAluno.map((b) => notificacoesService.notificarBatidaDeAluno({ ...b, timeZone }))
    ).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[ponto] falha ao notificar responsaveis:', err.message);
    });
  }


  return { totalRecebidos: registros.length, totalNovos, totalNaoResolvidos };
}

async function registrarBatidaManual(empresaId, { funcionarioId, dataHora, tipoBatida, observacao, criadoPorUsuarioId }) {
  const funcionario = await db('funcionarios').where({ id: funcionarioId, empresa_id: empresaId }).first();
  if (!funcionario) throw new AppError('Funcionario nao encontrado.', 404);

  const [registro] = await db('registros_ponto')
    .insert({
      empresa_id: empresaId,
      funcionario_id: funcionarioId,
      data_hora: dataHora,
      tipo_batida: tipoBatida || 'indefinido',
      origem: 'manual',
      criado_por_usuario_id: criadoPorUsuarioId,
    })
    .returning('*');

  // Toda batida manual (nao veio do REP) e registrada em auditoria: a Portaria
  // 671 trata o AFD do REP como imutavel, entao qualquer ajuste humano precisa
  // ficar rastreavel separadamente (o dado bruto do REP nunca e alterado).
  await db('auditoria_logs').insert({
    empresa_id: empresaId,
    usuario_id: criadoPorUsuarioId || null,
    acao: 'registrar_batida_manual',
    entidade: 'registros_ponto',
    entidade_id: String(registro.id),
    dados_depois: { data_hora: dataHora, tipo_batida: tipoBatida, observacao },
  });

  return registro;
}

/**
 * Recalcula o apontamento diario de um funcionario a partir das batidas
 * registradas (dispositivo + manuais). Pode ser chamado sob demanda ou por
 * um job noturno para o dia anterior.
 */
async function processarDia(empresaId, funcionarioId, data, usuarioId = null) {
  const funcionario = await db('funcionarios as f')
    .select('f.*', 'fi.fuso_horario as filial_fuso_horario')
    .leftJoin('filiais as fi', 'fi.id', 'f.filial_id')
    .where({ 'f.id': funcionarioId, 'f.empresa_id': empresaId })
    .first();
  if (!funcionario) throw new AppError('Funcionario nao encontrado.', 404);

  const timeZone = funcionario.filial_fuso_horario || FUSO_PADRAO;

  const horarioTrabalho = funcionario.horario_trabalho_id
    ? await db('horarios_trabalho').where({ id: funcionario.horario_trabalho_id }).first()
    : null;

  // Limites do dia calendario NO FUSO DA EMPRESA/FILIAL - nao no fuso do
  // processo do servidor (que normalmente e UTC), e a partir dos componentes
  // Y-M-D originais (nunca via new Date(string) + reinterpretacao, que
  // deslocaria o dia - ver comentario de extrairAnoMesDia acima).
  const { ano, mes, dia } = extrairAnoMesDia(data);
  const inicioDia = horaLocalParaUTC({ ano, mes, dia, hora: 0, minuto: 0 }, timeZone);
  const fimDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000 - 1);
  const dataReferenciaSql = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

  const registros = await db('registros_ponto')
    .where({ empresa_id: empresaId, funcionario_id: funcionarioId })
    .whereBetween('data_hora', [inicioDia, fimDia])
    .orderBy('data_hora', 'asc');

  const feriado = await db('feriados')
    .where({ data: dataReferenciaSql })
    .andWhere((qb) => qb.where('empresa_id', empresaId).orWhereNull('empresa_id'))
    .first();

  const horariosOrdenados = registros.map((r) => new Date(r.data_hora));

  const resultado = calcularApontamentoDoDia({
    horariosOrdenados,
    horarioTrabalho,
    data: inicioDia,
    ehFeriado: Boolean(feriado),
    timeZone,
  });

  return db.transaction(async (trx) => {
    const [apontamento] = await trx('apontamentos_diarios')
      .insert({
        empresa_id: empresaId,
        funcionario_id: funcionarioId,
        data: dataReferenciaSql,
        batidas: JSON.stringify(resultado.batidas),
        horas_previstas_minutos: resultado.horasPrevistasMinutos,
        horas_trabalhadas_minutos: resultado.horasTrabalhadasMinutos,
        saldo_minutos: resultado.saldoMinutos,
        extras_50_minutos: resultado.extras50Minutos,
        extras_100_minutos: resultado.extras100Minutos,
        adicional_noturno_minutos: resultado.adicionalNoturnoMinutos,
        atraso_minutos: resultado.atrasoMinutos,
        falta: resultado.falta,
        feriado: Boolean(feriado),
        status: resultado.jornadaAberta ? 'pendente' : 'aprovado',
        observacao: resultado.jornadaAberta
          ? 'Numero impar de batidas - jornada em aberto, revisar manualmente.'
          : resultado.aproximado
          ? 'Horario 12x36: previsao aproximada de 12h, confirmar se era dia de trabalho.'
          : null,
      })
      .onConflict(['funcionario_id', 'data'])
      .merge()
      .returning('*');

    await trx('registros_ponto')
      .where({ empresa_id: empresaId, funcionario_id: funcionarioId })
      .whereBetween('data_hora', [inicioDia, fimDia])
      .update({ processado: true });

    if (horarioTrabalho && horarioTrabalho.banco_horas_tipo_acordo !== 'nenhum' && !resultado.jornadaAberta) {
      await bancoHorasService.lancarPorApontamento(trx, {
        empresaId,
        funcionarioId,
        apontamentoDiarioId: apontamento.id,
        dataReferencia: apontamento.data,
        saldoMinutosDoDia: resultado.saldoMinutos,
      });
    }

    return apontamento;
  });
}

async function listarApontamentos(empresaId, { funcionarioId, de, ate }) {
  const query = db('apontamentos_diarios as a')
    .select('a.*', 'f.nome as funcionario_nome', 'f.matricula')
    .join('funcionarios as f', 'f.id', 'a.funcionario_id')
    .where('a.empresa_id', empresaId)
    .orderBy('a.data', 'desc');

  if (funcionarioId) query.where('a.funcionario_id', funcionarioId);
  if (de) query.where('a.data', '>=', de);
  if (ate) query.where('a.data', '<=', ate);

  return query;
}

/**
 * Resolve a foto de uma batida (capturada pelo equipamento no momento do
 * reconhecimento facial) pro caminho real em disco - sempre passando por
 * aqui (autenticado, escopado por empresa_id) em vez de expor storage/
 * direto via express.static, porque a mesma pasta tambem guarda arquivos
 * AFD (dado de fiscalizacao trabalhista, nunca publico - ver README secao
 * 5) e uma foto de uma pessoa batendo ponto e, em si, dado sensivel.
 */
async function buscarFoto(empresaId, registroId) {
  const registro = await db('registros_ponto').where({ id: registroId, empresa_id: empresaId }).first();
  if (!registro || !registro.foto_url) throw new AppError('Foto nao encontrada.', 404);
  return caminhoAbsoluto(registro.foto_url);
}

async function listarRegistrosNaoResolvidos(empresaId) {
  return db('registros_ponto as r')
    .select('r.*', 'd.descricao as dispositivo_descricao')
    .leftJoin('dispositivos as d', 'd.id', 'r.dispositivo_id')
    .where('r.empresa_id', empresaId)
    .whereNull('r.funcionario_id')
    .whereNull('r.aluno_id')
    .orderBy('r.data_hora', 'desc');
}

module.exports = {
  ingerirRegistros,
  registrarBatidaManual,
  processarDia,
  listarApontamentos,
  buscarFoto,
  listarRegistrosNaoResolvidos,
};
