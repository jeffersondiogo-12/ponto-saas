const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { publicarEvento } = require('../../realtime');

async function buscarAtribuicao(empresaId, professorId, turmaId) {
  const atribuicao = await db('turma_professores as tp')
    .join('turmas as t', 't.id', 'tp.turma_id')
    .where({ 'tp.empresa_id': empresaId, 'tp.professor_id': professorId, 'tp.turma_id': turmaId, 'tp.ativo': true })
    .first('tp.*', 't.filial_id', 't.nome as turma_nome');
  if (!atribuicao) throw new AppError('Professor nao esta atribuido a esta turma.', 403);
  return atribuicao;
}

async function listarMinhasTurmas(empresaId, professorId) {
  return db('turma_professores as tp')
    .join('turmas as t', 't.id', 'tp.turma_id')
    .select('tp.id as atribuicao_id', 'tp.turma_id', 't.nome', 't.ano_letivo', 't.turno', 'tp.materia', 'tp.dias_semana', 'tp.hora_inicio', 'tp.hora_fim')
    .where({ 'tp.empresa_id': empresaId, 'tp.professor_id': professorId, 'tp.ativo': true, 't.ativo': true })
    .orderBy('t.nome');
}

async function listarAlunos(empresaId, professorId, turmaId) {
  await buscarAtribuicao(empresaId, professorId, turmaId);
  return db('alunos').where({ empresa_id: empresaId, turma_id: turmaId, ativo: true }).select('id', 'nome', 'matricula').orderBy('nome');
}

async function registrarPresencas(empresaId, professorId, turmaId, data, presencas) {
  await buscarAtribuicao(empresaId, professorId, turmaId);
  if (!Array.isArray(presencas) || presencas.length === 0) throw new AppError('Informe ao menos uma presenca.', 400);

  const ids = presencas.map((item) => item.aluno_id);
  const alunos = await db('alunos').where({ empresa_id: empresaId, turma_id: turmaId }).whereIn('id', ids).select('id');
  if (alunos.length !== ids.length) throw new AppError('Um ou mais alunos nao pertencem a esta turma.', 400);

  const registros = presencas.map((item) => ({
    empresa_id: empresaId,
    turma_id: turmaId,
    aluno_id: item.aluno_id,
    professor_id: professorId,
    data,
    presente: item.presente !== false,
    observacao: item.observacao || null,
  }));
  const salvos = await db('presencas_sala').insert(registros).onConflict(['turma_id', 'aluno_id', 'professor_id', 'data']).merge().returning('*');
  salvos.forEach((registro) => publicarEvento('presenca.sala', { empresaId, alunoId: registro.aluno_id, turmaId }));
  return salvos;
}

async function criarNota(empresaId, professorId, turmaId, dados) {
  await buscarAtribuicao(empresaId, professorId, turmaId);
  await validarAluno(empresaId, turmaId, dados.aluno_id);
  const [nota] = await db('notas_alunos').insert({ ...dados, empresa_id: empresaId }).returning('*');
  publicarEvento('nota.criada', { empresaId, alunoId: dados.aluno_id });
  return nota;
}

async function criarObservacao(empresaId, professorId, turmaId, dados) {
  const atribuicao = await buscarAtribuicao(empresaId, professorId, turmaId);
  await validarAluno(empresaId, turmaId, dados.aluno_id);
  const [observacao] = await db('observacoes_alunos').insert({ ...dados, empresa_id: empresaId, autor_nome: dados.autor_nome || atribuicao.materia }).returning('*');
  publicarEvento('observacao.criada', { empresaId, alunoId: dados.aluno_id });
  return observacao;
}

async function validarAluno(empresaId, turmaId, alunoId) {
  const aluno = await db('alunos').where({ id: alunoId, empresa_id: empresaId, turma_id: turmaId, ativo: true }).first();
  if (!aluno) throw new AppError('Aluno nao pertence a esta turma.', 403);
}

async function atribuirProfessor(empresaId, turmaId, dados) {
  const turma = await db('turmas').where({ id: turmaId, empresa_id: empresaId }).first();
  if (!turma) throw new AppError('Turma nao encontrada.', 404);
  const professor = await db('usuarios').where({ id: dados.professor_id, empresa_id: empresaId, papel: 'professor', ativo: true }).first();
  if (!professor) throw new AppError('Usuario professor nao encontrado.', 404);
  if (!dados.materia || !dados.hora_inicio || !dados.hora_fim) throw new AppError('Materia e horario sao obrigatorios.', 400);
  const [atribuicao] = await db('turma_professores').insert({ empresa_id: empresaId, turma_id: turmaId, professor_id: dados.professor_id, materia: dados.materia, dias_semana: JSON.stringify(dados.dias_semana || []), hora_inicio: dados.hora_inicio, hora_fim: dados.hora_fim }).onConflict(['turma_id', 'professor_id', 'materia']).merge().returning('*');
  return atribuicao;
}

async function listarProfessoresDaTurma(empresaId, turmaId) {
  return db('turma_professores as tp').join('usuarios as u', 'u.id', 'tp.professor_id').where({ 'tp.empresa_id': empresaId, 'tp.turma_id': turmaId, 'tp.ativo': true }).select('tp.*', 'u.nome as professor_nome', 'u.email as professor_email');
}

module.exports = { listarMinhasTurmas, listarAlunos, registrarPresencas, criarNota, criarObservacao, atribuirProfessor, listarProfessoresDaTurma };
