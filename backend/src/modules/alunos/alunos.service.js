const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const responsaveisService = require('../responsaveis/responsaveis.service');
const { classificarBatidasDeAluno, janelaDeDiasCompletos } = require('../ponto/classificacaoBatidas');

function expressaoResponsaveisVinculados(alias = 'a') {
  return db.raw(`(
    SELECT COUNT(*)::int
    FROM responsavel_alunos ra
    JOIN responsaveis r ON r.id = ra.responsavel_id
    WHERE ra.aluno_id = ${alias}.id
      AND r.empresa_id = ${alias}.empresa_id
      AND r.ativo = true
  ) AS responsaveis_vinculados`);
}

async function listar(empresaId, { turmaId, filialId, ativo } = {}) {
  const query = db('alunos as a')
    .select(
      'a.*',
      't.nome as turma_nome',
      'f.nome as filial_nome',
      db.raw(`COALESCE((SELECT json_agg(ht ORDER BY ht.dia_semana) FROM horarios_turmas ht WHERE ht.turma_id = t.id AND ht.ativo = true), '[]'::json) AS horarios_turma`),
      expressaoResponsaveisVinculados(),
      // So o "tem ou nao": a foto em si vem por GET /:id/foto, quando a tela precisa.
      db.raw('EXISTS (SELECT 1 FROM fotos_alunos fa WHERE fa.aluno_id = a.id) AS tem_foto'),
    )
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .join('filiais as f', 'f.id', 'a.filial_id')
    .where('a.empresa_id', empresaId)
    .orderBy('a.nome');

  if (turmaId) query.where('a.turma_id', turmaId);
  if (filialId) query.where('a.filial_id', filialId);
  if (ativo !== undefined) query.where('a.ativo', ativo);

  return query;
}

async function buscarPorId(empresaId, alunoId, filialId = null) {
  const query = db('alunos as a')
    .select('a.*', expressaoResponsaveisVinculados())
    .where({ 'a.id': alunoId, 'a.empresa_id': empresaId });
  if (filialId) query.where('a.filial_id', filialId);
  const aluno = await query.first();
  if (!aluno) throw new AppError('Aluno nao encontrado.', 404);
  return aluno;
}

function normalizarTipoSanguineo(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string') {
    throw new AppError('Tipo sanguineo invalido.', 400);
  }

  const tipoSanguineo = valor.trim().toUpperCase();
  if (!tipoSanguineo) return null;
  if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(tipoSanguineo)) {
    throw new AppError('Tipo sanguineo invalido.', 400);
  }
  return tipoSanguineo;
}

async function normalizarCpfOpcional(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;

  const cpf = String(valor).replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    throw new AppError('CPF do aluno invalido.', 400);
  }

  const calcularDigito = (digitos, pesoInicial) => {
    const soma = digitos.reduce((total, digito, indice) => total + Number(digito) * (pesoInicial - indice), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  if (
    calcularDigito([...cpf.slice(0, 9)], 10) !== Number(cpf[9])
    || calcularDigito([...cpf.slice(0, 10)], 11) !== Number(cpf[10])
  ) {
    throw new AppError('CPF do aluno invalido.', 400);
  }

  return cpf;
}

async function resolverPorMatriculaDispositivo(empresaId, filialId, matriculaDispositivo, dados = {}) {
  const matricula = String(matriculaDispositivo ?? '').trim();
  if (!matricula) throw new AppError('A matrícula do dispositivo é obrigatória.', 400);

  const alunoExistente = await db('alunos')
    .where({ empresa_id: empresaId, matricula })
    .first();

  if (alunoExistente) return alunoExistente;

  const filial = await db('filiais')
    .where({ id: filialId, empresa_id: empresaId })
    .first();
  if (!filial) throw new AppError('Unidade nao encontrada.', 404);
  if (filial.tipo !== 'escola') {
    throw new AppError('Alunos só podem ser cadastrados em unidades do tipo escola.', 400);
  }

  const cpf = await normalizarCpfOpcional(dados.cpf);
  const nome = (dados.nome || 'Aluno importado do dispositivo').trim() || 'Aluno importado do dispositivo';

  const [aluno] = await db('alunos')
    .insert({
      empresa_id: empresaId,
      filial_id: filialId,
      turma_id: dados.turma_id || null,
      matricula,
      nome,
      cpf,
      data_nascimento: dados.data_nascimento || null,
      nome_responsavel: dados.nome_responsavel || null,
      contato_responsavel: dados.contato_responsavel || null,
      ativo: dados.ativo !== undefined ? Boolean(dados.ativo) : true,
    })
    .onConflict(['empresa_id', 'matricula'])
    .ignore()
    .returning('*');

  if (aluno) return aluno;

  return db('alunos').where({ empresa_id: empresaId, matricula }).first();
}

async function criar(empresaId, dados, filialId = null) {
  if (filialId && dados.filial_id !== filialId) throw new AppError('Aluno deve pertencer a filial do usuario.', 403);
  const temResponsavelExistente = dados.responsavel_id !== undefined && dados.responsavel_id !== null;
  if (temResponsavelExistente && dados.responsavel) {
    throw new AppError('Informe responsavel_id ou os dados de um novo responsavel, nao ambos.', 400);
  }
  const tipoSanguineo = normalizarTipoSanguineo(dados.tipo_sanguineo);
  const cpf = await normalizarCpfOpcional(dados.cpf);
  const matricula = String(dados.matricula || '').trim() || null;

  return db.transaction(async (trx) => {
    const filial = await trx('filiais').where({ id: dados.filial_id, empresa_id: empresaId }).first();
    if (!filial) throw new AppError('Unidade nao encontrada.', 404);
    if (filial.tipo !== 'escola') {
      throw new AppError('Alunos so podem ser cadastrados em unidades do tipo escola.', 400);
    }

    if (dados.turma_id) {
      const turma = await trx('turmas')
        .where({ id: dados.turma_id, empresa_id: empresaId, filial_id: dados.filial_id, ativo: true })
        .first();
      if (!turma) throw new AppError('Turma nao encontrada nesta filial.', 404);
    }

    if (matricula) {
      const matriculaExistente = await trx('alunos')
        .where({ empresa_id: empresaId, matricula })
        .first();
      if (matriculaExistente) throw new AppError('Ja existe um aluno com esta matricula.', 409);
    }

    const temContaResponsavel = temResponsavelExistente || Boolean(dados.responsavel);
    const nomeResponsavel = temContaResponsavel ? null : String(dados.nome_responsavel || '').trim() || null;
    const contatoResponsavel = temContaResponsavel ? null : String(dados.contato_responsavel || '').trim() || null;

    let [aluno] = await trx('alunos')
      .insert({
        empresa_id: empresaId,
        filial_id: dados.filial_id,
        turma_id: dados.turma_id || null,
        matricula,
        nome: dados.nome,
        cpf,
        tipo_sanguineo: tipoSanguineo,
        data_nascimento: dados.data_nascimento || null,
        nome_responsavel: nomeResponsavel,
        contato_responsavel: contatoResponsavel,
      })
      .returning('*');

    if (!temContaResponsavel) return { aluno, responsavel: null, vinculo: null };

    const acesso = temResponsavelExistente
      ? await responsaveisService.vincularContaExistenteAoAluno(
        trx, empresaId, aluno.id, dados.responsavel_id, dados.parentesco
      )
      : await responsaveisService.criarOuVincularAoAluno(
        trx, empresaId, aluno.id, dados.responsavel
      );

    [aluno] = await trx('alunos')
      .where({ id: aluno.id, empresa_id: empresaId })
      .update({
        nome_responsavel: acesso.responsavel.nome,
        contato_responsavel: acesso.responsavel.telefone || acesso.responsavel.email,
      })
      .returning('*');

    return { aluno, ...acesso };
  });
}

async function atualizar(empresaId, alunoId, dados, filialId = null) {
  const alunoAtual = await buscarPorId(empresaId, alunoId, filialId);
  const tipoSanguineo = dados.tipo_sanguineo === undefined
    ? undefined
    : normalizarTipoSanguineo(dados.tipo_sanguineo);
  const cpf = await normalizarCpfOpcional(dados.cpf);
  const matricula = String(dados.matricula || '').trim() || null;

  if (dados.turma_id) {
    const turma = await db('turmas').where({ id: dados.turma_id, empresa_id: empresaId, filial_id: alunoAtual.filial_id, ativo: true }).first();
    if (!turma) throw new AppError('Turma nao encontrada nesta filial.', 404);
  }

  if (matricula) {
    const matriculaExistente = await db('alunos')
      .where({ empresa_id: empresaId, matricula })
      .whereNot('id', alunoId)
      .first();
    if (matriculaExistente) throw new AppError('Já existe um aluno com esta matrícula.', 409);
  }

  return db.transaction(async (trx) => {
    let [aluno] = await trx('alunos')
      .where({ id: alunoId, empresa_id: empresaId })
      .update({
        matricula,
        turma_id: dados.turma_id || null,
        nome: dados.nome,
        cpf,
        ...(tipoSanguineo !== undefined ? { tipo_sanguineo: tipoSanguineo } : {}),
        data_nascimento: dados.data_nascimento || null,
        nome_responsavel: dados.nome_responsavel || null,
        contato_responsavel: dados.contato_responsavel || null,
        ativo: dados.ativo !== undefined ? dados.ativo : true,
      })
      .returning('*');

    let acesso = { responsavel: null, vinculo: null };
    if (dados.responsavel) {
      acesso = await responsaveisService.criarOuVincularAoAluno(
        trx,
        empresaId,
        aluno.id,
        dados.responsavel
      );
      [aluno] = await trx('alunos')
        .where({ id: aluno.id, empresa_id: empresaId })
        .update({
          nome_responsavel: acesso.responsavel.nome,
          contato_responsavel: acesso.responsavel.telefone || acesso.responsavel.email,
        })
        .returning('*');
    }

    const [{ total }] = await trx('responsavel_alunos as ra')
      .join('responsaveis as r', 'r.id', 'ra.responsavel_id')
      .where({
        'ra.aluno_id': aluno.id,
        'r.empresa_id': empresaId,
        'r.ativo': true,
      })
      .count('* as total');

    return {
      aluno: { ...aluno, responsaveis_vinculados: Number(total) },
      ...acesso,
    };
  });
}

/**
 * Vincula o aluno a um dispositivo, informando o ID interno que o proprio
 * equipamento usa para essa pessoa - mesmo mecanismo usado para funcionarios
 * (funcionario_dispositivos), so que numa tabela separada porque um aluno e
 * um funcionario sao cadastros diferentes.
 */
async function vincularDispositivo(empresaId, alunoId, dispositivoId, idNoDispositivo, filialId = null) {
  const aluno = await buscarPorId(empresaId, alunoId, filialId);

  const dispositivo = await db('dispositivos').where({ id: dispositivoId, empresa_id: empresaId }).first();
  if (!dispositivo) throw new AppError('Dispositivo nao encontrado.', 404);
  if (!dispositivo.filial_id || dispositivo.filial_id !== aluno.filial_id) {
    throw new AppError('O aluno e o dispositivo devem pertencer a mesma filial.', 400);
  }

  // Um mesmo ID interno do dispositivo nao pode already estar reservado por
  // um FUNCIONARIO (o equipamento nao distingue "tipo de pessoa" nos IDs dele).
  const colisaoComFuncionario = await db('funcionario_dispositivos')
    .where({ dispositivo_id: dispositivoId, id_no_dispositivo: String(idNoDispositivo) })
    .first();
  if (colisaoComFuncionario) {
    throw new AppError('Este ID já está em uso por um funcionário cadastrado neste dispositivo.', 409);
  }

  const [vinculo] = await db('aluno_dispositivos')
    .insert({ aluno_id: alunoId, dispositivo_id: dispositivoId, id_no_dispositivo: String(idNoDispositivo) })
    .onConflict(['aluno_id', 'dispositivo_id'])
    .merge({ id_no_dispositivo: String(idNoDispositivo) })
    .returning('*');

  return vinculo;
}

/**
 * Frequencia simples: so lista as batidas (chegada/saida) do periodo, sem
 * calculo de atraso/banco de horas - isso nao se aplica a alunos, so a
 * funcionarios sob CLT (ver README).
 */
async function frequencia(empresaId, alunoId, { de, ate } = {}, filialId = null) {
  await buscarPorId(empresaId, alunoId, filialId);

  const query = db('registros_ponto as r')
    .select(
      'r.id',
      'r.aluno_id',
      'r.data_hora',
      'r.origem',
      'r.tipo_batida',
      'f.fuso_horario as filial_fuso_horario',
    )
    .leftJoin('filiais as f', 'f.id', 'r.filial_id')
    .where({ 'r.empresa_id': empresaId, 'r.aluno_id': alunoId })
    .orderBy('r.data_hora', 'desc');

  // Dias fechados, pelo mesmo motivo das outras consultas de batida de aluno.
  const janela = janelaDeDiasCompletos(de, ate);
  if (janela.de) query.where('r.data_hora', '>=', janela.de);
  if (janela.ate) query.where('r.data_hora', '<=', janela.ate);

  const registros = await query;
  classificarBatidasDeAluno(registros);

  return registros.map(({ filial_fuso_horario, ...registro }) => registro);
}

async function excluir(empresaId, alunoId, filialId = null) {
  const aluno = await buscarPorId(empresaId, alunoId, filialId);

  const query = db('alunos').where({ id: alunoId, empresa_id: empresaId });
  if (filialId) query.where('filial_id', filialId);
  await query.del();

  return aluno;
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  excluir,
  vincularDispositivo,
  frequencia,
  resolverPorMatriculaDispositivo,
};
