const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

async function obterAlunoIdsVinculados(responsavelId) {
  const vinculos = await db('responsavel_alunos').where({ responsavel_id: responsavelId });
  return vinculos.map((v) => v.aluno_id);
}

async function login(email, senha) {
  const responsavel = await db('responsaveis').where({ email: email.toLowerCase().trim() }).first();

  if (!responsavel || !responsavel.ativo) {
    throw new AppError('Email ou senha invalidos.', 401);
  }

  const senhaOk = await bcrypt.compare(senha, responsavel.senha_hash);
  if (!senhaOk) {
    throw new AppError('Email ou senha invalidos.', 401);
  }

  await db('responsaveis').where({ id: responsavel.id }).update({ ultimo_login_em: db.fn.now() });

  const alunoIds = await obterAlunoIdsVinculados(responsavel.id);

  const payload = {
    tipo: 'responsavel',
    id: responsavel.id,
    responsavelId: responsavel.id,
    empresa_id: responsavel.empresa_id,
    nome: responsavel.nome,
    email: responsavel.email,
    alunoIds,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  return { token, responsavel: payload };
}

/**
 * Cadastro do responsavel + vinculo inicial com um aluno pela matricula (o
 * jeito mais simples de uma escola "convidar" um pai: dar a matricula do
 * filho, o proprio pai confirma o vinculo ao criar a conta).
 */
async function cadastrar({ empresa_id, nome, email, senha, telefone, matricula_aluno }) {
  const existente = await db('responsaveis').where({ email: email.toLowerCase().trim() }).first();
  if (existente) throw new AppError('Ja existe uma conta com este email.', 409);

  const aluno = await db('alunos').where({ empresa_id, matricula: matricula_aluno }).first();
  if (!aluno) throw new AppError('Matricula de aluno nao encontrada.', 404);

  const senha_hash = await bcrypt.hash(senha, 12);

  return db.transaction(async (trx) => {
    const [responsavel] = await trx('responsaveis')
      .insert({ empresa_id, nome, email: email.toLowerCase().trim(), senha_hash, telefone: telefone || null })
      .returning('*');

    await trx('responsavel_alunos').insert({ responsavel_id: responsavel.id, aluno_id: aluno.id });

    return responsavel;
  });
}

async function vincularAluno(empresaId, responsavelId, matriculaAluno, parentesco) {
  const responsavel = await db('responsaveis').where({ id: responsavelId, empresa_id: empresaId }).first();
  if (!responsavel) throw new AppError('Responsavel nao encontrado.', 404);

  const aluno = await db('alunos').where({ empresa_id: empresaId, matricula: matriculaAluno }).first();
  if (!aluno) throw new AppError('Matricula de aluno nao encontrada.', 404);

  const [vinculo] = await db('responsavel_alunos')
    .insert({ responsavel_id: responsavelId, aluno_id: aluno.id, parentesco: parentesco || null })
    .onConflict(['responsavel_id', 'aluno_id'])
    .merge({ parentesco: parentesco || null })
    .returning('*');

  return vinculo;
}

async function listarAlunosVinculados(alunoIds) {
  if (!alunoIds || alunoIds.length === 0) return [];

  return db('alunos as a')
    .select('a.id', 'a.nome', 'a.matricula', 't.nome as turma_nome', 'f.nome as filial_nome')
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .join('filiais as f', 'f.id', 'a.filial_id')
    .whereIn('a.id', alunoIds);
}

async function frequenciaDoAluno(alunoIdsPermitidos, alunoId, { de, ate } = {}) {
  if (!alunoIdsPermitidos.includes(alunoId)) {
    throw new AppError('Voce nao tem acesso a este aluno.', 403);
  }

  const query = db('registros_ponto')
    .select('data_hora', 'origem')
    .where({ aluno_id: alunoId })
    .orderBy('data_hora', 'desc');

  if (de) query.where('data_hora', '>=', de);
  if (ate) query.where('data_hora', '<=', ate);

  return query;
}

async function notasDoAluno(alunoIdsPermitidos, alunoId) {
  if (!alunoIdsPermitidos.includes(alunoId)) {
    throw new AppError('Voce nao tem acesso a este aluno.', 403);
  }

  return db('notas_alunos')
    .select('id', 'disciplina', 'etapa', 'nota', 'observacao', 'created_at')
    .where({ aluno_id: alunoId })
    .orderBy('created_at', 'desc');
}

async function observacoesDoAluno(alunoIdsPermitidos, alunoId) {
  if (!alunoIdsPermitidos.includes(alunoId)) {
    throw new AppError('Voce nao tem acesso a este aluno.', 403);
  }

  return db('observacoes_alunos')
    .select('id', 'titulo', 'texto', 'autor_nome', 'created_at')
    .where({ aluno_id: alunoId })
    .orderBy('created_at', 'desc');
}

async function registrarPushToken(responsavelId, token, plataforma) {
  const [registro] = await db('push_tokens')
    .insert({ responsavel_id: responsavelId, token, plataforma })
    .onConflict(['token'])
    .merge({ responsavel_id: responsavelId, plataforma })
    .returning('*');

  return registro;
}

module.exports = {
  login,
  cadastrar,
  vincularAluno,
  listarAlunosVinculados,
  frequenciaDoAluno,
  notasDoAluno,
  observacoesDoAluno,
  registrarPushToken,
  obterAlunoIdsVinculados,
};
