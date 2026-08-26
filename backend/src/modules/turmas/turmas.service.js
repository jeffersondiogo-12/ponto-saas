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
  const turmaAtual = await buscarPorId(empresaId, turmaId);

  if (dados.ativo === false) {
    const alunosAtivos = await db('alunos').where({ turma_id: turmaId, ativo: true }).count('* as total').first();
    if (Number(alunosAtivos.total) > 0) {
      throw new AppError('Nao e possivel inativar uma turma com alunos ativos.', 409);
    }
  }

  const [turma] = await db('turmas')
    .where({ id: turmaAtual.id, empresa_id: empresaId })
    .update({
      nome: dados.nome,
      turno: dados.turno,
      ano_letivo: dados.ano_letivo,
      ativo: dados.ativo !== undefined ? dados.ativo : true,
    })
    .returning('*');

  return turma;
}

module.exports = { listar, buscarPorId, criar, atualizar };
