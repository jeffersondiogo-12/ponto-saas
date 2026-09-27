const db = require('../../config/db');
const webpush = require('web-push');
const { inicioDoDiaNoFuso, fimDoDiaNoFuso } = require('../../utils/tempo');
const { tipoDaBatidaNoDia } = require('../ponto/classificacaoBatidas');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const FUSO_PADRAO = 'America/Sao_Paulo';
let webPushConfigurado = false;
let avisoWebPushSemConfiguracaoEmitido = false;

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

function configurarWebPush() {
  if (webPushConfigurado) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  const ausentes = [
    ['VAPID_PUBLIC_KEY', VAPID_PUBLIC_KEY],
    ['VAPID_PRIVATE_KEY', VAPID_PRIVATE_KEY],
    ['VAPID_SUBJECT', VAPID_SUBJECT],
  ].filter(([, valor]) => !valor).map(([nome]) => nome);
  if (ausentes.length) {
    if (!avisoWebPushSemConfiguracaoEmitido) {
      console.error(`[notificacoes] Web Push desativado; variaveis ausentes: ${ausentes.join(', ')}`);
      avisoWebPushSemConfiguracaoEmitido = true;
    }
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  webPushConfigurado = true;
  return true;
}

async function enviarWebPush(inscricao, { title, body, data }) {
  if (!inscricao?.endpoint || !inscricao.p256dh || !inscricao.auth) return null;
  try {
    if (!configurarWebPush()) return null;
    const resposta = await webpush.sendNotification({
      endpoint: inscricao.endpoint,
      keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
    }, JSON.stringify({ title, body, data }));
    console.info(`[notificacoes] Web Push aceito pelo gateway (HTTP ${resposta.statusCode || 'desconhecido'})`);
    return resposta;
  } catch (err) {
    if ([404, 410].includes(err.statusCode)) {
      try {
        await db('push_web').where({ id: inscricao.id }).del();
        console.warn(`[notificacoes] inscricao Web Push expirada removida (HTTP ${err.statusCode})`);
      } catch (deleteError) {
        console.error('[notificacoes] falha ao remover inscricao Web Push vencida:', deleteError.message);
      }
      return null;
    }
    console.error('[notificacoes] falha ao enviar Web Push:', err.message);
    return null;
  }
}

async function enviarParaResponsaveis(responsavelIds, mensagem) {
  const ids = [...new Set((responsavelIds || []).filter(Boolean))];
  if (!ids.length) return;

  const [tokens, inscricoes] = await Promise.all([
    db('push_tokens').whereIn('responsavel_id', ids).distinct('token'),
    db('push_web').whereIn('responsavel_id', ids).select('id', 'endpoint', 'p256dh', 'auth'),
  ]);
  console.info(`[notificacoes] destinatarios encontrados: responsaveis=${ids.length}, Expo=${tokens.length}, Web=${inscricoes.length}`);
  await Promise.all([
    ...tokens.map(({ token }) => enviarPush({ to: token, ...mensagem })),
    ...inscricoes.map((inscricao) => enviarWebPush(inscricao, mensagem)),
  ]);
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

async function buscarResponsaveisDoAluno(alunoId, empresaId) {
  return db('responsavel_alunos as ra')
    .join('responsaveis as r', 'r.id', 'ra.responsavel_id')
    .join('alunos as a', 'a.id', 'ra.aluno_id')
    .where({
      'ra.aluno_id': alunoId,
      'a.id': alunoId,
      'a.empresa_id': empresaId,
      'a.ativo': true,
      'r.empresa_id': empresaId,
      'r.ativo': true,
    })
    .distinct('r.id');
}

async function notificarBatidaDeAluno({ alunoId, dataHora, timeZone = FUSO_PADRAO }) {
  const aluno = await db('alunos').where({ id: alunoId }).first();
  if (!aluno || !aluno.ativo) return;
  const responsaveis = await buscarResponsaveisDoAluno(alunoId, aluno.empresa_id);
  if (!responsaveis.length) return;

  const tipo = await inferirTipoParaNotificacao(alunoId, dataHora, timeZone);
  const horaLocal = new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(new Date(dataHora));
  const corpo = tipo === 'entrada' ? `Chegada registrada às ${horaLocal}` : `Saída registrada às ${horaLocal}`;
  await enviarParaResponsaveis(responsaveis.map(({ id }) => id), {
    title: aluno.nome,
    body: corpo,
    data: { alunoId, tipo },
  });
}

async function notificarFaltaEmSala({ alunoId, turmaId, atribuicaoId, materia, data, presente }) {
  if (presente) return;
  const aluno = await db('alunos').where({ id: alunoId }).first();
  if (!aluno || !aluno.ativo) return;
  const responsaveis = await buscarResponsaveisDoAluno(alunoId, aluno.empresa_id);
  if (!responsaveis.length) return;
  await enviarParaResponsaveis(responsaveis.map(({ id }) => id), {
    title: `Falta em ${materia || 'aula'}`,
    body: `${aluno.nome} foi marcado como ausente em ${materia || 'aula'}${data ? ` no dia ${data}` : ''}.`,
    data: { alunoId, turmaId, atribuicaoId, materia, data, presente: false, tipo: 'falta_sala' },
  });
}

module.exports = { enviarPush, enviarWebPush, enviarParaResponsaveis, notificarBatidaDeAluno, notificarFaltaEmSala };
