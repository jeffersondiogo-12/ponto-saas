const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

async function listar(empresaId, { filialId, ativo } = {}) {
  const query = db('professores as p')
    .select('p.*', 'f.nome as filial_nome')
    .leftJoin('filiais as f', 'f.id', 'p.filial_id')
    .where('p.empresa_id', empresaId)
    .orderBy('p.nome');

  if (filialId) query.where('p.filial_id', filialId);
  if (ativo !== undefined) query.where('p.ativo', ativo);

  return query;
}

async function buscarPorId(empresaId, professorId) {
  const professor = await db('professores').where({ id: professorId, empresa_id: empresaId }).first();
  if (!professor) throw new AppError('Professor nao encontrado.', 404);
  return professor;
}

async function login(email, senha) {
  const professor = await db('professores').where({ email: String(email).trim().toLowerCase() }).first();
  if (!professor || !professor.ativo) {
    throw new AppError('Email ou senha invalidos.', 401);
  }

  const senhaOk = await bcrypt.compare(senha, professor.senha_hash);
  if (!senhaOk) {
    throw new AppError('Email ou senha invalidos.', 401);
  }

  await db('professores').where({ id: professor.id }).update({ ultimo_login_em: db.fn.now() });

  const payload = {
    tipo: 'professor',
    id: professor.id,
    professorId: professor.id,
    empresa_id: professor.empresa_id,
    filial_id: professor.filial_id,
    papel: 'professor',
    nome: professor.nome,
    email: professor.email,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  return { token, professor: payload };
}

async function criar(empresaId, dados) {
  const email = String(dados.email || '').trim().toLowerCase();
  if (!email) throw new AppError('Email do professor e obrigatorio.', 400);

  const existente = await db('professores').where({ empresa_id: empresaId, email }).first();
  if (existente) throw new AppError('Ja existe um professor com este email.', 409);

  const [professor] = await db('professores')
    .insert({
      empresa_id: empresaId,
      filial_id: dados.filial_id || null,
      nome: String(dados.nome || '').trim(),
      email,
      senha_hash: await bcrypt.hash(dados.senha || '123456', 12),
      telefone: dados.telefone || null,
    })
    .returning('*');

  return professor;
}

async function atualizar(empresaId, professorId, dados) {
  await buscarPorId(empresaId, professorId);

  const updates = {
    nome: dados.nome,
    telefone: dados.telefone || null,
    filial_id: dados.filial_id || null,
    ativo: dados.ativo !== undefined ? dados.ativo : true,
  };

  if (dados.senha) {
    updates.senha_hash = await bcrypt.hash(dados.senha, 12);
  }

  const [professor] = await db('professores')
    .where({ id: professorId, empresa_id: empresaId })
    .update(updates)
    .returning('*');

  return professor;
}

async function listarTurmasDoProfessor(empresaId, professorId) {
  await buscarPorId(empresaId, professorId);

  return db('professor_turmas as pt')
    .select('t.id', 't.nome', 't.turno', 't.ano_letivo', 'f.nome as filial_nome')
    .join('turmas as t', 't.id', 'pt.turma_id')
    .join('filiais as f', 'f.id', 't.filial_id')
    .where('t.empresa_id', empresaId)
    .andWhere('pt.professor_id', professorId)
    .orderBy('t.nome');
}

async function vincularTurma(empresaId, professorId, turmaId) {
  await buscarPorId(empresaId, professorId);

  const turma = await db('turmas').where({ id: turmaId, empresa_id: empresaId }).first();
  if (!turma) throw new AppError('Turma nao encontrada.', 404);

  const [vinculo] = await db('professor_turmas')
    .insert({ professor_id: professorId, turma_id: turmaId, turno: turma.turno || 'manha' })
    .onConflict(['professor_id', 'turma_id'])
    .merge({ turno: turma.turno || 'manha' })
    .returning('*');

  return vinculo;
}

module.exports = {
  listar,
  buscarPorId,
  login,
  criar,
  atualizar,
  listarTurmasDoProfessor,
  vincularTurma,
};
