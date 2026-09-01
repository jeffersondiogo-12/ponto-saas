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

async function listarHorarios(empresaId, turmaId) {
  await buscarPorId(empresaId, turmaId);
  return db('horarios_turmas').where({ empresa_id: empresaId, turma_id: turmaId }).limit(1);
}

async function salvarHorario(empresaId, turmaId, dados) {
  await buscarPorId(empresaId, turmaId);
  if (!dados.hora_entrada || !dados.hora_saida || dados.hora_saida <= dados.hora_entrada) {
    throw new AppError('Horario de entrada e saida invalido.', 400);
  }
  const [horario] = await db('horarios_turmas')
    .insert({ empresa_id: empresaId, turma_id: turmaId, dia_semana: null, hora_entrada: dados.hora_entrada, hora_saida: dados.hora_saida, ativo: dados.ativo !== false })
    .onConflict(['turma_id'])
    .merge(['hora_entrada', 'hora_saida', 'ativo', 'updated_at'])
    .returning('*');
  return horario;
}

async function removerHorario(empresaId, turmaId, horarioId) {
  await buscarPorId(empresaId, turmaId);
  const removidos = await db('horarios_turmas').where({ id: horarioId, empresa_id: empresaId, turma_id: turmaId }).del();
  if (!removidos) throw new AppError('Horario da turma nao encontrado.', 404);
}

async function excluir(empresaId, turmaId) {
  const turma = await buscarPorId(empresaId, turmaId);

  await db('turmas').where({ id: turmaId, empresa_id: empresaId }).del();

  return turma;
}

module.exports = { listar, buscarPorId, criar, atualizar, excluir, listarHorarios, salvarHorario, removerHorario };
