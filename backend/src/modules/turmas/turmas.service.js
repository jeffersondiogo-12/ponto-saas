const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

async function listar(empresaId, { filialId } = {}) {
  const query = db('turmas as t')
    .select('t.*', 'f.nome as filial_nome')
    .join('filiais as f', 'f.id', 't.filial_id')
    .where('t.empresa_id', empresaId)
    .orderBy('t.ano_letivo', 'desc')
    .orderBy('t.nome');

  if (filialId) query.where('t.filial_id', filialId);

  return query;
}

async function buscarPorId(empresaId, turmaId) {
  const turma = await db('turmas').where({ id: turmaId, empresa_id: empresaId }).first();
  if (!turma) throw new AppError('Turma nao encontrada.', 404);
  return turma;
}

async function criar(empresaId, dados) {
  const filial = await db('filiais').where({ id: dados.filial_id, empresa_id: empresaId }).first();
  if (!filial) throw new AppError('Unidade nao encontrada.', 404);
  if (filial.tipo !== 'escola') {
    throw new AppError('Turmas só podem ser criadas em unidades do tipo escola.', 400);
  }

  const [turma] = await db('turmas')
    .insert({
      empresa_id: empresaId,
      filial_id: dados.filial_id,
      nome: dados.nome,
      turno: dados.turno || 'manha',
      ano_letivo: dados.ano_letivo,
    })
    .returning('*');

  return turma;
}

async function atualizar(empresaId, turmaId, dados) {
  await buscarPorId(empresaId, turmaId);

  const [turma] = await db('turmas')
    .where({ id: turmaId, empresa_id: empresaId })
    .update({
      nome: dados.nome,
      turno: dados.turno,
      ano_letivo: dados.ano_letivo,
      ativo: dados.ativo !== undefined ? dados.ativo : true,
    })
    .returning('*');

  return turma;
}

async function excluir(empresaId, turmaId) {
  const turma = await buscarPorId(empresaId, turmaId);

  await db('turmas').where({ id: turmaId, empresa_id: empresaId }).del();

  return turma;
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir };
