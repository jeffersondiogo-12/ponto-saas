const db = require('../../config/db');
const { inicioDoDiaNoFuso, fimDoDiaNoFuso } = require('../../utils/tempo');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const FUSO_PADRAO = 'America/Sao_Paulo';

async function enviarPush({ to, title, body, data }) {
  if (!to) return null;
  try {
    const resposta = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to, title, body, data, sound: 'default' }),
    });
    return await resposta.json();
  } catch (err) {
    console.error('[notificacoes] falha ao enviar push:', err.message);
    return null;
  }
}

async function inferirTipoParaNotificacao(alunoId, dataHora, timeZone) {
  const inicioDia = inicioDoDiaNoFuso(dataHora, timeZone);
  const fimDia = fimDoDiaNoFuso(dataHora, timeZone);
  const { total } = await db('registros_ponto')
    .where({ aluno_id: alunoId })
    .whereBetween('data_hora', [inicioDia, fimDia])
    .andWhere('data_hora', '<', dataHora)
    .count('id as total')
    .first();
  return Number(total) % 2 === 0 ? 'chegada' : 'saida';
}

async function notificarBatidaDeAluno({ alunoId, dataHora, timeZone = FUSO_PADRAO }) {
  const aluno = await db('alunos').where({ id: alunoId }).first();
  if (!aluno) return;
  const vinculos = await db('responsavel_alunos').where({ aluno_id: alunoId });
  if (!vinculos.length) return;
  const tokens = await db('push_tokens').whereIn('responsavel_id', vinculos.map((v) => v.responsavel_id));
  if (!tokens.length) return;

  const tipo = await inferirTipoParaNotificacao(alunoId, dataHora, timeZone);
  const horaLocal = new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(dataHora));
  const corpo = tipo === 'chegada' ? `Chegada registrada às ${horaLocal}` : `Saída registrada às ${horaLocal}`;
  await Promise.all(tokens.map((token) => enviarPush({
    to: token.token,
    title: aluno.nome,
    body: corpo,
    data: { alunoId, tipo },
  })));
}

async function notificarFaltaEmSala({ alunoId, turmaId, atribuicaoId, materia, data, presente }) {
  if (presente) return;
  const aluno = await db('alunos').where({ id: alunoId }).first();
  if (!aluno) return;
  const vinculos = await db('responsavel_alunos').where({ aluno_id: alunoId });
  if (!vinculos.length) return;
  const tokens = await db('push_tokens').whereIn('responsavel_id', vinculos.map((v) => v.responsavel_id));
  if (!tokens.length) return;
  await Promise.all(tokens.map((token) => enviarPush({
    to: token.token,
    title: `Falta em ${materia || 'aula'}`,
    body: `${aluno.nome} foi marcado como ausente em ${materia || 'aula'}${data ? ` no dia ${data}` : ''}.`,
    data: { alunoId, turmaId, atribuicaoId, materia, data, presente: false, tipo: 'falta_sala' },
  })));
}

module.exports = { enviarPush, notificarBatidaDeAluno, notificarFaltaEmSala };
