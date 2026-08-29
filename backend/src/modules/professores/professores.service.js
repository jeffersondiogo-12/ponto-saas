const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { publicarEvento } = require('../../realtime');
const notificacoesService = require('../responsaveis/notificacoes.service');

function horaEmMinutos(valor) {
  const [hora, minuto] = String(valor || '').split(':').map(Number);
  return hora * 60 + minuto;
}

function diaAtualNoFuso(timeZone) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(new Date());
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[partes];
}

function dataAtualNoFuso(timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

function validarData(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) throw new AppError('Data deve estar no formato YYYY-MM-DD.', 400);
  const objeto = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(objeto.getTime()) || objeto.toISOString().slice(0, 10) !== data) throw new AppError('Data da chamada invalida.', 400);
}

function diferencaDias(dataInicial, dataFinal) {
  return Math.floor((Date.parse(`${dataFinal}T00:00:00Z`) - Date.parse(`${dataInicial}T00:00:00Z`)) / 86400000);
}

function validarAulaNoMomento(atribuicao, timeZone, data, permitirGestor = false) {
  validarData(data);
  const hoje = dataAtualNoFuso(timeZone);
  const dias = Array.isArray(atribuicao.dias_semana) ? atribuicao.dias_semana : JSON.parse(atribuicao.dias_semana || '[]');
  const diaDaData = new Date(`${data}T12:00:00Z`).getUTCDay();
  if (!dias.includes(diaDaData)) throw new AppError('A chamada so pode ser registrada no dia da aula.', 400);
  if (permitirGestor || data !== hoje) return;
  const agora = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const minutoAtual = horaEmMinutos(agora);
  if (!permitirGestor && (minutoAtual < horaEmMinutos(atribuicao.hora_inicio) || minutoAtual > horaEmMinutos(atribuicao.hora_fim))) {
    throw new AppError('A chamada so pode ser registrada no horario da aula.', 400);
  }
}

async function buscarAtribuicao(empresaId, professorId, turmaId, atribuicaoId, permitirGestor = false) {
  if (!atribuicaoId) throw new AppError('atribuicao_id e obrigatorio.', 400);
  const atribuicao = await db('turma_professores as tp')
    .join('turmas as t', 't.id', 'tp.turma_id')
    .where({ 'tp.empresa_id': empresaId, 'tp.turma_id': turmaId, 'tp.ativo': true })
    .modify((query) => { if (!permitirGestor) query.where('tp.professor_id', professorId); })
    .modify((query) => { if (atribuicaoId) query.where('tp.id', atribuicaoId); })
    .first('tp.*', 't.filial_id', 't.nome as turma_nome');
  if (!atribuicao) throw new AppError('Professor nao esta atribuido a esta turma.', 403);
  return atribuicao;
}

async function listarMinhasTurmas(empresaId, professorId) {
  return db('turma_professores as tp')
    .join('turmas as t', 't.id', 'tp.turma_id')
    .select('tp.id as atribuicao_id', 'tp.turma_id', 't.nome', 't.ano_letivo', 't.turno', 'tp.materia', 'tp.dias_semana', 'tp.hora_inicio', 'tp.hora_fim')
    .select(db.raw(`COALESCE((SELECT json_agg(ht ORDER BY ht.dia_semana) FROM horarios_turmas ht WHERE ht.turma_id = t.id AND ht.ativo = true), '[]'::json) AS horarios_turma`))
    .where({ 'tp.empresa_id': empresaId, 'tp.professor_id': professorId, 'tp.ativo': true, 't.ativo': true })
    .orderBy('t.nome');
}

async function listarAlunos(empresaId, professorId, turmaId, atribuicaoId) {
  const atribuicao = await buscarAtribuicao(empresaId, professorId, turmaId, atribuicaoId);
  const filial = await db('filiais').where({ id: atribuicao.filial_id, empresa_id: empresaId }).first();
  const timeZone = filial?.fuso_horario || 'America/Sao_Paulo';
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  return db('alunos as a')
    .where({ 'a.empresa_id': empresaId, 'a.turma_id': turmaId, 'a.ativo': true })
    .select(
      'a.id',
      'a.nome',
      'a.matricula',
      db.raw(`EXISTS (
        SELECT 1 FROM registros_ponto rp
        WHERE rp.aluno_id = a.id
          AND (rp.data_hora AT TIME ZONE ?)::date = ?
      ) AS presenca_facial`, [timeZone, hoje])
    )
    .orderBy('a.nome');
}

async function registrarPresencas(empresaId, professorId, turmaId, data, presencas, atribuicaoId, permitirGestor = false, usuarioId = null) {
  const atribuicao = await buscarAtribuicao(empresaId, professorId, turmaId, atribuicaoId, permitirGestor);
  if (!Array.isArray(presencas) || presencas.length === 0) throw new AppError('Informe ao menos uma presenca.', 400);

  const filial = await db('filiais').where({ id: atribuicao.filial_id, empresa_id: empresaId }).first();
  const timeZone = filial?.fuso_horario || 'America/Sao_Paulo';
  const dias = Array.isArray(atribuicao.dias_semana) ? atribuicao.dias_semana : JSON.parse(atribuicao.dias_semana || '[]');
  validarData(data);
  const hoje = dataAtualNoFuso(timeZone);
  if (diferencaDias(data, hoje) < 0 || diferencaDias(data, hoje) > 2) throw new AppError('A chamada retroativa esta limitada aos ultimos 2 dias.', 400);
  validarAulaNoMomento(atribuicao, timeZone, data, permitirGestor);

  const ids = presencas.map((item) => item.aluno_id);
  const alunos = await db('alunos').where({ empresa_id: empresaId, turma_id: turmaId }).whereIn('id', ids).select('id');
  if (alunos.length !== ids.length) throw new AppError('Um ou mais alunos nao pertencem a esta turma.', 400);


  const faltasJustificadasSemTexto = presencas.filter((item) => item.presente === false && item.falta_justificada && !String(item.justificativa || '').trim());
  if (faltasJustificadasSemTexto.length > 0) throw new AppError('Informe a justificativa para cada falta justificada.', 400);

  const registros = presencas.map((item) => ({
    empresa_id: empresaId,
    turma_id: turmaId,
    aluno_id: item.aluno_id,
    professor_id: atribuicao.professor_id,
    atribuicao_id: atribuicao.id,
    materia: atribuicao.materia,
    data,
    presente: item.presente !== false,
    falta_justificada: item.presente === false && item.falta_justificada === true,
    justificativa: item.presente === false && item.falta_justificada ? String(item.justificativa).trim() : null,
    observacao: item.observacao || null,
  }));
  const salvos = await db('presencas_sala').insert(registros).onConflict(['atribuicao_id', 'aluno_id', 'data']).merge().returning('*');
  if (permitirGestor || data !== hoje) {
    await db('auditoria_logs').insert({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      acao: permitirGestor ? 'corrigir_presenca_sala' : 'registrar_presenca_retroativa',
      entidade: 'presencas_sala',
      entidade_id: String(salvos[0]?.id || ''),
      dados_depois: { turma_id: turmaId, atribuicao_id: atribuicao.id, materia: atribuicao.materia, data, quantidade: salvos.length },
    });
  }
  salvos.forEach((registro) => {
    const dadosEvento = { empresaId, alunoId: registro.aluno_id, turmaId, professorId: registro.professor_id, atribuicaoId: atribuicao.id, materia: atribuicao.materia, presente: registro.presente, data };
    publicarEvento('presenca.sala', dadosEvento);
    if (!registro.presente) notificacoesService.notificarFaltaEmSala(dadosEvento).catch(() => {});
  });
  return salvos;
}

async function criarNota(empresaId, professorId, turmaId, dados) {
  const atribuicao = await buscarAtribuicao(empresaId, professorId, turmaId, dados.atribuicao_id);
  await validarAluno(empresaId, turmaId, dados.aluno_id);
  const bimestre = Number(dados.bimestre);
  const valor = Number(dados.nota);
  if (![1, 2, 3, 4].includes(bimestre)) throw new AppError('Bimestre deve ser 1, 2, 3 ou 4.', 400);
  if (!Number.isFinite(valor) || valor < 0 || valor > 10) throw new AppError('Nota deve estar entre 0 e 10.', 400);
  if (!String(dados.tipo_avaliacao || '').trim()) throw new AppError('Tipo da avaliacao e obrigatorio.', 400);
  const [nota] = await db('notas_alunos').insert({
    empresa_id: empresaId,
    aluno_id: dados.aluno_id,
    disciplina: dados.disciplina || atribuicao.materia,
    etapa: `Bimestre ${bimestre}`,
    bimestre,
    tipo_avaliacao: String(dados.tipo_avaliacao).trim(),
    atividade: String(dados.atividade || '').trim() || null,
    nota: valor,
    observacao: dados.observacao || null,
  }).returning('*');
  publicarEvento('nota.criada', { empresaId, alunoId: dados.aluno_id });
  return nota;
}

async function criarObservacao(empresaId, professorId, turmaId, dados) {
  const atribuicao = await buscarAtribuicao(empresaId, professorId, turmaId, dados.atribuicao_id);
  await validarAluno(empresaId, turmaId, dados.aluno_id);
  const filial = await db('filiais').where({ id: atribuicao.filial_id, empresa_id: empresaId }).first();
  validarAulaNoMomento(atribuicao, filial?.fuso_horario || 'America/Sao_Paulo', dataAtualNoFuso(filial?.fuso_horario || 'America/Sao_Paulo'));
  const [observacao] = await db('observacoes_alunos').insert({
    empresa_id: empresaId,
    aluno_id: dados.aluno_id,
    titulo: String(dados.titulo || '').trim(),
    texto: String(dados.texto || '').trim(),
    autor_nome: dados.autor_nome || atribuicao.materia,
  }).returning('*');
  publicarEvento('observacao.criada', { empresaId, alunoId: dados.aluno_id });
  return observacao;
}

async function validarAluno(empresaId, turmaId, alunoId) {
  const aluno = await db('alunos').where({ id: alunoId, empresa_id: empresaId, turma_id: turmaId, ativo: true }).first();
  if (!aluno) throw new AppError('Aluno nao pertence a esta turma.', 403);
}

/**
 * Contexto rapido pro professor antes de lancar uma nova nota/observacao:
 * o que ja foi lancado por ele (mesma materia da atribuicao) pra este aluno
 * nesta turma. Nao ha coluna turma_id/professor_id em notas_alunos nem
 * observacoes_alunos (ver migration 20260822000001) - notas sao filtradas
 * pela materia da atribuicao atual, observacoes vem todas do aluno.
 */
async function historicoDoAluno(empresaId, professorId, turmaId, alunoId, atribuicaoId) {
  const atribuicao = await buscarAtribuicao(empresaId, professorId, turmaId, atribuicaoId);
  await validarAluno(empresaId, turmaId, alunoId);

  const [notas, observacoes] = await Promise.all([
    db('notas_alunos')
      .select('id', 'disciplina', 'etapa', 'nota', 'observacao', 'created_at')
      .where({ aluno_id: alunoId, disciplina: atribuicao.materia })
      .orderBy('created_at', 'desc')
      .limit(10),
    db('observacoes_alunos')
      .select('id', 'titulo', 'texto', 'autor_nome', 'created_at')
      .where({ aluno_id: alunoId })
      .orderBy('created_at', 'desc')
      .limit(10),
  ]);

  return { notas, observacoes };
}

async function atribuirProfessor(empresaId, turmaId, dados) {
  const turma = await db('turmas').where({ id: turmaId, empresa_id: empresaId }).first();
  if (!turma) throw new AppError('Turma nao encontrada.', 404);
  const professor = await db('usuarios').where({ id: dados.professor_id, empresa_id: empresaId, papel: 'professor', ativo: true }).first();
  if (!professor) throw new AppError('Usuario professor nao encontrado.', 404);
  if (!dados.materia || !dados.hora_inicio || !dados.hora_fim) throw new AppError('Materia e horario sao obrigatorios.', 400);
  if (dados.hora_fim <= dados.hora_inicio) throw new AppError('Horario da aula invalido.', 400);
  const dias = Array.isArray(dados.dias_semana) ? dados.dias_semana.map(Number) : [];
  if (!dias.length || dias.some((dia) => !Number.isInteger(dia) || dia < 0 || dia > 6)) {
    throw new AppError('Informe ao menos um dia valido para a aula.', 400);
  }
  const janelaTurma = await db('horarios_turmas').where({ empresa_id: empresaId, turma_id: turmaId, ativo: true }).first();
  if (!janelaTurma || dados.hora_inicio < janelaTurma.hora_entrada || dados.hora_fim > janelaTurma.hora_saida) {
    throw new AppError('A aula deve ficar dentro do horario da turma.', 400);
  }
  const atribuicoesAtivas = await db('turma_professores')
    .where({ empresa_id: empresaId, turma_id: turmaId, ativo: true })
    .whereNot({ professor_id: dados.professor_id, materia: dados.materia });
  const conflitos = atribuicoesAtivas.filter((atribuicao) => {
    const diasExistentes = Array.isArray(atribuicao.dias_semana) ? atribuicao.dias_semana : JSON.parse(atribuicao.dias_semana || '[]');
    const mesmoDia = dias.some((dia) => diasExistentes.includes(dia));
    const sobreposto = atribuicao.hora_inicio < dados.hora_fim && atribuicao.hora_fim > dados.hora_inicio;
    return mesmoDia && sobreposto;
  });
  if (conflitos.length > 0) throw new AppError('Existe outra aula sobreposta nesta turma e horario.', 409);
  const [atribuicao] = await db('turma_professores').insert({ empresa_id: empresaId, turma_id: turmaId, professor_id: dados.professor_id, materia: dados.materia, dias_semana: JSON.stringify(dias), hora_inicio: dados.hora_inicio, hora_fim: dados.hora_fim }).onConflict(['turma_id', 'professor_id', 'materia']).merge().returning('*');
  publicarEvento('turma.atribuida', { empresaId, professorId: dados.professor_id });
  return atribuicao;
}

async function listarProfessoresDaTurma(empresaId, turmaId) {
  return db('turma_professores as tp').join('usuarios as u', 'u.id', 'tp.professor_id').where({ 'tp.empresa_id': empresaId, 'tp.turma_id': turmaId, 'tp.ativo': true }).select('tp.*', 'u.nome as professor_nome', 'u.email as professor_email');
}

async function listarGradeTurma(empresaId, turmaId) {
  const turma = await db('turmas').where({ id: turmaId, empresa_id: empresaId }).first();
  if (!turma) throw new AppError('Turma nao encontrada.', 404);
  const [janela, aulas] = await Promise.all([
    db('horarios_turmas').where({ empresa_id: empresaId, turma_id: turmaId, ativo: true }).first(),
    db('turma_professores as tp').join('usuarios as u', 'u.id', 'tp.professor_id')
      .where({ 'tp.empresa_id': empresaId, 'tp.turma_id': turmaId, 'tp.ativo': true })
      .select('tp.id as atribuicao_id', 'tp.materia', 'tp.dias_semana', 'tp.hora_inicio', 'tp.hora_fim', 'u.id as professor_id', 'u.nome as professor_nome')
      .orderBy('tp.hora_inicio'),
  ]);
  return { janela_turma: janela || null, aulas };
}

module.exports = { listarMinhasTurmas, listarAlunos, registrarPresencas, criarNota, criarObservacao, historicoDoAluno, atribuirProfessor, listarProfessoresDaTurma, listarGradeTurma };
