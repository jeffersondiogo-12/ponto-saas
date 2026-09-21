const db = require('../../config/db');
const { inicioDoDiaNoFuso, fimDoDiaNoFuso } = require('../../utils/tempo');
const { tipoDaBatidaNoDia } = require('../ponto/classificacaoBatidas');

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

/**
 * Chegada ou saida desta batida, pela MESMA regra que as telas usam
 * (ponto/classificacaoBatidas.js): conta quantas passagens do aluno ja
 * existem antes desta no mesmo dia e alterna. Sem isso, o push e a ficha
 * podiam discordar sobre a mesma batida.
 */
async function inferirTipoParaNotificacao(alunoId, dataHora, timeZone) {
  const inicioDia = inicioDoDiaNoFuso(dataHora, timeZone);
  const fimDia = fimDoDiaNoFuso(dataHora, timeZone);
  const { total } = await db('registros_ponto')
    .where({ aluno_id: alunoId })
    .whereBetween('data_hora', [inicioDia, fimDia])
    .andWhere('data_hora', '<', dataHora)
    .count('id as total')
    .first();
  return tipoDaBatidaNoDia(total);
}

async function notificarBatidaDeAluno({ alunoId, dataHora, timeZone = FUSO_PADRAO }) {
  const aluno = await db('alunos').where({ id: alunoId }).first();
  if (!aluno || !aluno.ativo) return;
  const tokens = await db('push_tokens as pt')
    .join('responsaveis as r', 'r.id', 'pt.responsavel_id')
    .join('responsavel_alunos as ra', 'ra.responsavel_id', 'r.id')
    .join('alunos as a', 'a.id', 'ra.aluno_id')
    .where({
      'ra.aluno_id': alunoId,
      'a.id': alunoId,
      'a.empresa_id': aluno.empresa_id,
      'r.empresa_id': aluno.empresa_id,
      'r.ativo': true,
    })
    .distinct('pt.token');
  if (!tokens.length) return;

  const tipo = await inferirTipoParaNotificacao(alunoId, dataHora, timeZone);
  const horaLocal = new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(dataHora));
  const corpo = tipo === 'entrada' ? `Chegada registrada às ${horaLocal}` : `Saída registrada às ${horaLocal}`;
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
  if (!aluno || !aluno.ativo) return;
  const tokens = await db('push_tokens as pt')
    .join('responsaveis as r', 'r.id', 'pt.responsavel_id')
    .join('responsavel_alunos as ra', 'ra.responsavel_id', 'r.id')
    .join('alunos as a', 'a.id', 'ra.aluno_id')
    .where({
      'ra.aluno_id': alunoId,
      'a.id': alunoId,
      'a.empresa_id': aluno.empresa_id,
      'r.empresa_id': aluno.empresa_id,
      'r.ativo': true,
    })
    .distinct('pt.token');
  if (!tokens.length) return;
  await Promise.all(tokens.map((token) => enviarPush({
    to: token.token,
    title: `Falta em ${materia || 'aula'}`,
    body: `${aluno.nome} foi marcado como ausente em ${materia || 'aula'}${data ? ` no dia ${data}` : ''}.`,
    data: { alunoId, turmaId, atribuicaoId, materia, data, presente: false, tipo: 'falta_sala' },
  })));
}

module.exports = { enviarPush, notificarBatidaDeAluno, notificarFaltaEmSala };
