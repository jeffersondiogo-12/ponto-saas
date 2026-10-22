const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { encryptFaceQueueData, decryptFaceQueueData } = require('../../utils/crypto');
const { extrairBase64Puro } = require('./fotoStorage');

const TAMANHO_MAXIMO_FOTO_BYTES = 4 * 1024 * 1024;
const processamentosAtivos = new Set();

function normalizarFoto(fotoBase64) {
  if (typeof fotoBase64 !== 'string') {
    throw new AppError('Envie uma foto facial valida em Base64.', 400);
  }
  const base64 = extrairBase64Puro(fotoBase64.trim());
  if (
    !base64 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
  ) {
    throw new AppError('Envie uma foto facial valida em Base64.', 400);
  }

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > TAMANHO_MAXIMO_FOTO_BYTES) {
    throw new AppError('A foto facial deve ter no maximo 4 MB.', 400);
  }
  if (bytes.toString('base64') !== base64) {
    throw new AppError('A foto facial enviada nao esta em Base64 valido.', 400);
  }
  return base64;
}

function matriculaComoIdDispositivo(matricula) {
  const valor = String(matricula || '').trim();
  if (!/^[1-9]\d*$/.test(valor) || !Number.isSafeInteger(Number(valor))) {
    throw new AppError(
      'A matricula precisa ser um numero inteiro positivo, sem zeros a esquerda, para ser usada como ID no equipamento.',
      400
    );
  }
  return valor;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ehUuid = (valor) => typeof valor === 'string' && UUID.test(valor);

/** O equipamento que aceita cadastro remoto de face: ativo e Evo por WebSocket. */
async function buscarDispositivoFacial(empresaId, dispositivoId) {
  if (!ehUuid(dispositivoId)) {
    throw new AppError('Informe um dispositivo valido.', 400);
  }
  const dispositivo = await db('dispositivos')
    .where({ id: dispositivoId, empresa_id: empresaId, situacao: 'ativo' })
    .first();
  if (!dispositivo) throw new AppError('Dispositivo ativo nao encontrado.', 404);
  if (dispositivo.protocolo !== 'evo_ws') {
    throw new AppError(
      'O cadastro facial remoto esta disponivel somente para equipamentos Evo conectados por WebSocket.',
      400
    );
  }
  return dispositivo;
}

/**
 * Confere o aluno contra o equipamento e poe a foto (ja normalizada) na fila
 * cifrada. Nao envia: quem chama processa a fila. Devolve o ID usado no relogio.
 */
async function enfileirarFaceAluno(empresaId, alunoId, dispositivo, foto, filialId = null) {
  if (!ehUuid(alunoId)) throw new AppError('Aluno nao encontrado.', 404);
  const aluno = await db('alunos').where({ id: alunoId, empresa_id: empresaId }).first();
  if (!aluno || (filialId && aluno.filial_id !== filialId)) {
    throw new AppError('Aluno nao encontrado.', 404);
  }
  if (!aluno.ativo) throw new AppError('Nao e possivel cadastrar face de aluno inativo.', 400);
  if (!dispositivo.filial_id || dispositivo.filial_id !== aluno.filial_id) {
    throw new AppError('O aluno e o dispositivo devem pertencer a mesma unidade.', 400);
  }

  const idNoDispositivo = matriculaComoIdDispositivo(aluno.matricula);
  const fotoCifrada = encryptFaceQueueData(foto);

  await db.transaction(async (trx) => {
    const funcionarioComMesmoId = await trx('funcionario_dispositivos')
      .where({ dispositivo_id: dispositivo.id, id_no_dispositivo: idNoDispositivo })
      .first();
    if (funcionarioComMesmoId) {
      throw new AppError('A matricula deste aluno ja esta em uso por um funcionario neste equipamento.', 409);
    }

    const outroAlunoComMesmoId = await trx('aluno_dispositivos')
      .where({ dispositivo_id: dispositivo.id, id_no_dispositivo: idNoDispositivo })
      .whereNot({ aluno_id: aluno.id })
      .first();
    if (outroAlunoComMesmoId) {
      throw new AppError('A matricula deste aluno ja esta vinculada a outro aluno neste equipamento.', 409);
    }

    await trx('faces_alunos_pendentes')
      .insert({
        empresa_id: empresaId,
        filial_id: aluno.filial_id,
        dispositivo_id: dispositivo.id,
        aluno_id: aluno.id,
        id_no_dispositivo: idNoDispositivo,
        foto_cifrada: fotoCifrada,
      })
      .onConflict(['dispositivo_id', 'aluno_id'])
      .merge({
        id_no_dispositivo: idNoDispositivo,
        foto_cifrada: fotoCifrada,
        tentativas: 0,
        ultimo_erro: null,
        updated_at: db.fn.now(),
      });
  });

  return idNoDispositivo;
}

async function cadastrarFaceAluno(empresaId, alunoId, { dispositivoId, fotoBase64 }, filialId = null) {
  const dispositivo = await buscarDispositivoFacial(empresaId, dispositivoId);
  const foto = normalizarFoto(fotoBase64);
  const idNoDispositivo = await enfileirarFaceAluno(empresaId, alunoId, dispositivo, foto, filialId);

  await processarFacesPendentes(dispositivo.id);
  const pendente = await db('faces_alunos_pendentes')
    .where({ dispositivo_id: dispositivo.id, aluno_id: alunoId })
    .first();

  return {
    idNoDispositivo,
    sincronizado: !pendente,
    pendente: Boolean(pendente),
    tentativas: pendente?.tentativas || 0,
    erro: pendente?.ultimo_erro || null,
  };
}

/**
 * Envia ao equipamento a foto GUARDADA (`fotos_alunos`) de cada aluno da lista
 * - o envio em lote da tela de Dispositivos. Cada aluno passa pelas mesmas
 * travas do envio avulso, e quem falha nao impede os outros: o motivo volta no
 * resultado dele. A fila e processada uma vez, no fim.
 *
 * Estados por aluno: `enviado` (o equipamento confirmou), `pendente` (na fila
 * cifrada, sobe quando o equipamento se conectar) ou `erro` (com `mensagem`).
 */
async function enviarAlunosSalvos(empresaId, dispositivoId, alunoIds, { usuarioId = null, filialId = null } = {}) {
  if (!Array.isArray(alunoIds) || alunoIds.length === 0) {
    throw new AppError('Selecione ao menos um aluno.', 400);
  }
  if (alunoIds.length > 500) throw new AppError('Envie no maximo 500 alunos por vez.', 400);

  const dispositivo = await buscarDispositivoFacial(empresaId, dispositivoId);
  // Aqui, e nao no topo: fotoAluno.service importa normalizarFoto deste arquivo.
  const fotoAlunoService = require('../alunos/fotoAluno.service');

  const resultados = [];
  for (const alunoId of [...new Set(alunoIds)]) {
    try {
      const foto = await fotoAlunoService.lerBase64(empresaId, alunoId);
      await enfileirarFaceAluno(empresaId, alunoId, dispositivo, foto, filialId);
      resultados.push({ aluno_id: alunoId, estado: 'na_fila', mensagem: null });
    } catch (err) {
      // Recusa de regra vira resultado do aluno; falha de banco derruba o pedido.
      if (!(err instanceof AppError)) throw err;
      resultados.push({ aluno_id: alunoId, estado: 'erro', mensagem: err.message });
    }
  }

  const naFila = resultados.filter((r) => r.estado === 'na_fila').map((r) => r.aluno_id);
  if (naFila.length) {
    await processarFacesPendentes(dispositivo.id);
    const pendentes = await db('faces_alunos_pendentes')
      .where({ dispositivo_id: dispositivo.id })
      .whereIn('aluno_id', naFila)
      .select('aluno_id', 'ultimo_erro');
    const ainda = new Map(pendentes.map((p) => [p.aluno_id, p.ultimo_erro]));
    for (const r of resultados) {
      if (r.estado !== 'na_fila') continue;
      r.estado = ainda.has(r.aluno_id) ? 'pendente' : 'enviado';
      r.mensagem = ainda.get(r.aluno_id) || null;
    }

    await db('auditoria_logs').insert({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      acao: 'enviar_fotos_alunos_equipamento',
      entidade: 'dispositivos',
      entidade_id: dispositivo.id,
      dados_depois: { alunos: naFila },
    });
  }

  return { resultados };
}

async function processarFacesPendentes(dispositivoId) {
  if (processamentosAtivos.has(dispositivoId)) return 0;
  processamentosAtivos.add(dispositivoId);

  try {
    const dispositivo = await db('dispositivos')
      .where({ id: dispositivoId, situacao: 'ativo', protocolo: 'evo_ws' })
      .first();
    if (!dispositivo) return 0;

    const evoFacialServidor = require('./evoFacialServidor');
    if (!evoFacialServidor.canalComandoDisponivel(dispositivo.numero_serie)) return 0;

    const adapter = require('./adapters').criarAdapter(dispositivo);
    const pendentesInativos = await db('faces_alunos_pendentes as p')
      .join('alunos as a', 'a.id', 'p.aluno_id')
      .where('p.dispositivo_id', dispositivo.id)
      .where((query) =>
        query
          .where('a.ativo', false)
          .orWhere('a.filial_id', '!=', dispositivo.filial_id)
          .orWhere('a.empresa_id', '!=', dispositivo.empresa_id)
      )
      .select('p.id');
    if (pendentesInativos.length) {
      await db('faces_alunos_pendentes')
        .whereIn('id', pendentesInativos.map((pendente) => pendente.id))
        .del();
    }

    const pendentes = await db('faces_alunos_pendentes as p')
      .join('alunos as a', 'a.id', 'p.aluno_id')
      .where('p.dispositivo_id', dispositivo.id)
      .where('a.ativo', true)
      .where('a.filial_id', dispositivo.filial_id)
      .where('a.empresa_id', dispositivo.empresa_id)
      .select('p.*', 'a.nome as nome_atual', 'a.matricula as matricula_atual')
      .orderBy('p.created_at', 'asc');

    let totalEnviados = 0;
    for (const pendente of pendentes) {
      if (!evoFacialServidor.canalComandoDisponivel(dispositivo.numero_serie)) break;

      try {
        const idNoDispositivo = matriculaComoIdDispositivo(pendente.matricula_atual);
        const conflitoFuncionario = await db('funcionario_dispositivos')
          .where({
            dispositivo_id: dispositivo.id,
            id_no_dispositivo: idNoDispositivo,
          })
          .first();
        if (conflitoFuncionario) {
          throw new AppError('A matricula esta vinculada a um funcionario neste equipamento.', 409);
        }

        const conflitoAluno = await db('aluno_dispositivos')
          .where({
            dispositivo_id: dispositivo.id,
            id_no_dispositivo: idNoDispositivo,
          })
          .whereNot({ aluno_id: pendente.aluno_id })
          .first();
        if (conflitoAluno) {
          throw new AppError('A matricula esta vinculada a outro aluno neste equipamento.', 409);
        }

        await adapter.cadastrarFace({
          enrollId: idNoDispositivo,
          nome: pendente.nome_atual,
          fotoBase64: decryptFaceQueueData(pendente.foto_cifrada),
        });
        await db.transaction(async (trx) => {
          await trx('aluno_dispositivos')
            .insert({
              aluno_id: pendente.aluno_id,
              dispositivo_id: dispositivo.id,
              id_no_dispositivo: idNoDispositivo,
            })
            .onConflict(['aluno_id', 'dispositivo_id'])
            .merge({ id_no_dispositivo: idNoDispositivo });
          await trx('faces_alunos_pendentes').where({ id: pendente.id }).del();
        });
        totalEnviados += 1;
      } catch (err) {
        await db('faces_alunos_pendentes')
          .where({ id: pendente.id })
          .update({
            tentativas: db.raw('tentativas + 1'),
            ultimo_erro: String(err.message || 'Falha ao enviar a face').slice(0, 1000),
          });
        console.error(
          `[evo-facial] face pendente do aluno ${pendente.aluno_id} nao enviada ao dispositivo ${dispositivo.id}:`,
          err.message
        );
        if (!evoFacialServidor.canalComandoDisponivel(dispositivo.numero_serie)) break;
      }
    }
    return totalEnviados;
  } finally {
    processamentosAtivos.delete(dispositivoId);
  }
}

module.exports = { cadastrarFaceAluno, enviarAlunosSalvos, processarFacesPendentes, normalizarFoto };
