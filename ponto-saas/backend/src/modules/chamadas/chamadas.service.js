const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

async function listar(empresaId, { turmaId, data } = {}) {
  const query = db('chamadas as c')
    .select('c.*', 't.nome as turma_nome', 'p.nome as professor_nome')
    .join('turmas as t', 't.id', 'c.turma_id')
    .join('professores as p', 'p.id', 'c.professor_id')
    .where('c.empresa_id', empresaId)
    .orderBy('c.data', 'desc');

  if (turmaId) query.where('c.turma_id', turmaId);
  if (data) query.where('c.data', data);

  return query;
}

async function buscarOuCriarChamada(empresaId, professorId, turmaId, data) {
  const professor = await db('professores').where({ id: professorId, empresa_id: empresaId }).first();
  if (!professor) throw new AppError('Professor nao encontrado.', 404);

  const turma = await db('turmas').where({ id: turmaId, empresa_id: empresaId }).first();
  if (!turma) throw new AppError('Turma nao encontrada.', 404);

  let chamada = await db('chamadas').where({ turma_id: turmaId, data }).first();
  if (!chamada) {
    [chamada] = await db('chamadas')
      .insert({
        empresa_id: empresaId,
        turma_id: turmaId,
        professor_id: professorId,
        data,
        status: 'aberta',
      })
      .returning('*');
  }

  return chamada;
}

async function listarAlunosDaChamada(empresaId, professorId, turmaId, data) {
  const chamada = await buscarOuCriarChamada(empresaId, professorId, turmaId, data);
  const alunos = await db('alunos as a')
    .select('a.id', 'a.nome', 'a.matricula', 'a.cpf', 'a.data_nascimento', 'a.foto_url', 'a.horario_entrada', 'a.horario_saida', 't.nome as turma_nome')
    .leftJoin('turmas as t', 't.id', 'a.turma_id')
    .where({ 'a.empresa_id': empresaId, 'a.turma_id': turmaId })
    .orderBy('a.nome', 'asc');

  const presencas = await db('presencas').where({ chamada_id: chamada.id });
  const mapa = new Map(presencas.map((p) => [p.aluno_id, p]));

  return alunos.map((aluno) => ({
    ...aluno,
    status: mapa.get(aluno.id)?.status || 'pendente',
    observacao: mapa.get(aluno.id)?.observacao || null,
    marcada: Boolean(mapa.get(aluno.id)),
  }));
}

async function marcarPresenca(empresaId, professorId, turmaId, data, alunoId, status, observacao = null) {
  const chamada = await buscarOuCriarChamada(empresaId, professorId, turmaId, data);
  const aluno = await db('alunos').where({ id: alunoId, empresa_id: empresaId }).first();
  if (!aluno) throw new AppError('Aluno nao encontrado.', 404);

  const valorStatus = ['presente', 'ausente', 'atrasado', 'justificado', 'pendente'].includes(status)
    ? status
    : 'presente';

  const [presenca] = await db('presencas')
    .insert({
      chamada_id: chamada.id,
      aluno_id: alunoId,
      status: valorStatus,
      observacao,
    })
    .onConflict(['chamada_id', 'aluno_id'])
    .merge({ status: valorStatus, observacao })
    .returning('*');

  return presenca;
}

async function salvarChamada(empresaId, professorId, turmaId, data, presencas) {
  const chamada = await buscarOuCriarChamada(empresaId, professorId, turmaId, data);

  for (const item of presencas || []) {
    await marcarPresenca(empresaId, professorId, turmaId, data, item.aluno_id, item.status, item.observacao || null);
  }

  await db('chamadas').where({ id: chamada.id }).update({ status: 'fechada' });

  return { chamada: { ...chamada, status: 'fechada' } };
}

module.exports = {
  listar,
  buscarOuCriarChamada,
  listarAlunosDaChamada,
  marcarPresenca,
  salvarChamada,
};
