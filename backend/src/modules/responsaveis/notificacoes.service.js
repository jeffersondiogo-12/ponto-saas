const db = require('../../config/db');
const { inicioDoDiaNoFuso, fimDoDiaNoFuso } = require('../../utils/tempo');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const FUSO_PADRAO = 'America/Sao_Paulo';

/**
 * Envia pelo servico de push do Expo (https://exp.host) em vez de integrar
 * direto com APNs/FCM - eles cuidam disso, evitando toda a complexidade de
 * certificado/chave por plataforma so para mandar uma notificacao.
 * Best-effort: uma falha aqui nunca derruba a ingestao de ponto que disparou
 * a notificacao (por isso o catch silencioso, so logado).
 */
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
    // eslint-disable-next-line no-console
    console.error('[notificacoes] falha ao enviar push:', err.message);
    return null;
  }
}

/**
 * Decide se esta batida e "chegada" ou "saida" contando quantas batidas o
 * aluno ja teve HOJE (no fuso da unidade) antes desta: 1a, 3a, 5a... =
 * chegada; 2a, 4a... = saida. Mesma logica de pareamento par/impar usada em
 * calculoJornada.js, so que calculada incrementalmente em tempo real para a
 * mensagem da notificacao - a fonte de verdade da frequencia continua sendo
 * a lista bruta de registros_ponto.
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

  return Number(total) % 2 === 0 ? 'chegada' : 'saida';
}

/**
 * Notifica todos os responsaveis vinculados ao aluno sobre uma nova batida.
 * Chamado DEPOIS que a ingestao ja commitou (nunca dentro da transacao -
 * uma chamada de rede lenta ou instavel nao pode travar/derrubar a coleta).
 */
async function notificarBatidaDeAluno({ alunoId, dataHora, timeZone = FUSO_PADRAO }) {
  const aluno = await db('alunos').where({ id: alunoId }).first();
  if (!aluno) return;


async function notificarFaltaEmSala({ alunoId, turmaId, atribuicaoId, materia, data, presente }) {
  if (presente) return;
  const aluno = await db('alunos').where({ id: alunoId }).first();
  if (!aluno) return;
  const vinculos = await db('responsavel_alunos').where({ aluno_id: alunoId });
  if (!vinculos.length) return;
  const tokens = await db('push_tokens').whereIn('responsavel_id', vinculos.map((v) => v.responsavel_id));
  await Promise.all(tokens.map((token) => enviarPush({
    to: token.token,
    title: `Falta em ${materia || 'aula'}`,
    body: `${aluno.nome} foi marcado como ausente em ${materia || 'aula'} no dia ${data}.`,
    data: { alunoId, turmaId, atribuicaoId, materia, data, presente: false, tipo: 'falta_sala' },
  })));
}
  const vinculos = await db('responsavel_alunos').where({ aluno_id: alunoId });
module.exports = { enviarPush, notificarBatidaDeAluno, notificarFaltaEmSala };

  const tokens = await db('push_tokens').whereIn(
    'responsavel_id',
    vinculos.map((v) => v.responsavel_id)
  );
  if (tokens.length === 0) return;

  const tipo = await inferirTipoParaNotificacao(alunoId, dataHora, timeZone);
  const horaLocal = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dataHora));

  const titulo = aluno.nome;
  const corpo =
    tipo === 'chegada' ? `Chegada registrada às ${horaLocal}` : `Saída registrada às ${horaLocal}`;

  await Promise.all(
    tokens.map((t) =>
      enviarPush({
        to: t.token,
        title: titulo,
        body: corpo,
        data: { alunoId, tipo },
      })
    )
  );
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

module.exports = { notificarBatidaDeAluno, notificarFaltaEmSala };
