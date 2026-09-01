const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const responsaveisService = require('../responsaveis/responsaveis.service');

async function listar(empresaId, { turmaId, ativo } = {}) {
  const query = db('alunos as a')
    .select(
      'a.*',
      't.nome as turma_nome',
      'f.nome as filial_nome',
      db.raw(`COALESCE((SELECT json_agg(ht ORDER BY ht.dia_semana) FROM horarios_turmas ht WHERE ht.turma_id = t.id AND ht.ativo = true), '[]'::json) AS horarios_turma`),
    )
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .join('filiais as f', 'f.id', 'a.filial_id')
    .where('a.empresa_id', empresaId)
    .orderBy('a.nome');

  if (turmaId) query.where('a.turma_id', turmaId);
  if (ativo !== undefined) query.where('a.ativo', ativo);

  return query;
}

async function buscarPorId(empresaId, alunoId) {
  const aluno = await db('alunos').where({ id: alunoId, empresa_id: empresaId }).first();
  if (!aluno) throw new AppError('Aluno nao encontrado.', 404);
  return aluno;
}

async function normalizarCpfOpcional(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;

  const cpf = String(valor).replace(/\D/g, '');
  if (cpf && cpf.length !== 11) throw new AppError('CPF do aluno deve ter 11 digitos.', 400);
  return cpf || null;
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
      horario_aluno_id: dados.horario_aluno_id || null,
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

async function criar(empresaId, dados) {
  const cpf = await normalizarCpfOpcional(dados.cpf);
  const matricula = String(dados.matricula || '').trim() || null;
  const horarioAlunoId = dados.horario_aluno_id || null;

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

    if (horarioAlunoId) {
      const horario = await trx('horarios_alunos').where({ id: horarioAlunoId }).first();
      if (!horario) throw new AppError('Horario escolar nao encontrado.', 404);
    }

    if (matricula) {
      const matriculaExistente = await trx('alunos')
        .where({ empresa_id: empresaId, matricula })
        .first();
      if (matriculaExistente) throw new AppError('Ja existe um aluno com esta matricula.', 409);
    }

    const nomeResponsavel = String(dados.responsavel?.nome || dados.nome_responsavel || '').trim() || null;
    const contatoResponsavel = String(
      dados.responsavel
        ? (dados.responsavel.telefone || dados.responsavel.email || '')
        : (dados.contato_responsavel || '')
    ).trim() || null;

    const [aluno] = await trx('alunos')
      .insert({
        empresa_id: empresaId,
        filial_id: dados.filial_id,
        turma_id: dados.turma_id || null,
        horario_aluno_id: horarioAlunoId,
        matricula,
        nome: dados.nome,
        cpf,
        data_nascimento: dados.data_nascimento || null,
        nome_responsavel: nomeResponsavel,
        contato_responsavel: contatoResponsavel,
      })
      .returning('*');

    if (!dados.responsavel) return { aluno, responsavel: null, vinculo: null };

    const acesso = await responsaveisService.criarOuVincularAoAluno(
      trx,
      empresaId,
      aluno.id,
      dados.responsavel
    );

    return { aluno, ...acesso };
  });
}

async function atualizar(empresaId, alunoId, dados) {
  const alunoAtual = await buscarPorId(empresaId, alunoId);
  const cpf = await normalizarCpfOpcional(dados.cpf);
  const matricula = String(dados.matricula || '').trim() || null;

  if (dados.turma_id) {
    const turma = await db('turmas').where({ id: dados.turma_id, empresa_id: empresaId, filial_id: alunoAtual.filial_id, ativo: true }).first();
    if (!turma) throw new AppError('Turma nao encontrada nesta filial.', 404);
  }

  const horarioAlunoId = dados.horario_aluno_id || null;
  if (horarioAlunoId) {
    const horario = await db('horarios_alunos').where({ id: horarioAlunoId }).first();
    if (!horario) throw new AppError('Horario escolar nao encontrado.', 404);
  }

  if (matricula) {
    const matriculaExistente = await db('alunos')
      .where({ empresa_id: empresaId, matricula })
      .whereNot('id', alunoId)
      .first();
    if (matriculaExistente) throw new AppError('Já existe um aluno com esta matrícula.', 409);
  }

  const [aluno] = await db('alunos')
    .where({ id: alunoId, empresa_id: empresaId })
    .update({
      matricula,
      turma_id: dados.turma_id || null,
      horario_aluno_id: horarioAlunoId,
      nome: dados.nome,
      cpf,
      data_nascimento: dados.data_nascimento || null,
      nome_responsavel: dados.nome_responsavel || null,
      contato_responsavel: dados.contato_responsavel || null,
      ativo: dados.ativo !== undefined ? dados.ativo : true,
    })
    .returning('*');

  return aluno;
}

/**
 * Vincula o aluno a um dispositivo, informando o ID interno que o proprio
 * equipamento usa para essa pessoa - mesmo mecanismo usado para funcionarios
 * (funcionario_dispositivos), so que numa tabela separada porque um aluno e
 * um funcionario sao cadastros diferentes.
 */
async function vincularDispositivo(empresaId, alunoId, dispositivoId, idNoDispositivo) {
  const aluno = await buscarPorId(empresaId, alunoId);

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
async function frequencia(empresaId, alunoId, { de, ate } = {}) {
  await buscarPorId(empresaId, alunoId);

  const query = db('registros_ponto')
    .select('data_hora', 'origem')
    .where({ empresa_id: empresaId, aluno_id: alunoId })
    .orderBy('data_hora', 'desc');

  if (de) query.where('data_hora', '>=', de);
  if (ate) query.where('data_hora', '<=', ate);

  return query;
}

async function excluir(empresaId, alunoId) {
  const aluno = await buscarPorId(empresaId, alunoId);

  await db('alunos').where({ id: alunoId, empresa_id: empresaId }).del();

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
