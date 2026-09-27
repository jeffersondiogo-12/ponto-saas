import { api } from '../api';
import { ehIos, instalado } from './instalacao';
import { bytesDaChave, inscritaComChave } from './chaveVapid';

/**
 * Notificacao com o app fechado (Web Push), so para o responsavel — como no
 * APK. O backend guarda a inscricao (`POST /api/responsaveis/push-web`, com a
 * inscricao inteira no corpo), apaga ao sair (`DELETE`, com o endpoint) e
 * envia pelo web-push nos mesmos pontos do Expo: passagem no equipamento,
 * falta em sala e aviso. Quem mostra a notificacao e o `public/sw.js`.
 */
const CHAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * O aparelho recebe notificacao com o app fechado? No iPhone, so com o PWA
 * instalado na tela de inicio (iOS 16.4 ou mais); numa aba do Safari, nao.
 */
export function suportaPush() {
  return Boolean(CHAVE_PUBLICA)
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    && (!ehIos() || instalado());
}

export function permissaoAtual() {
  return 'Notification' in window ? Notification.permission : 'denied';
}

async function inscrever() {
  const registro = await navigator.serviceWorker.getRegistration();
  if (!registro) throw new Error('O app ainda está terminando de instalar. Feche e abra de novo para ativar as notificações.');
  let inscricao = await registro.pushManager.getSubscription();
  // Inscricao feita com outra chave (o par VAPID mudou): o servico de push
  // recusaria o envio. Apaga no servidor, cancela e faz de novo — sem pedir
  // nada a pessoa, que ja tinha permitido.
  if (inscricao && !inscritaComChave(inscricao, CHAVE_PUBLICA)) {
    await api.responsavel.removerPushWeb(inscricao.endpoint).catch(() => {});
    await inscricao.unsubscribe();
    inscricao = null;
  }
  inscricao = inscricao
    || await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDaChave(CHAVE_PUBLICA) });
  await api.responsavel.registrarPushWeb(inscricao.toJSON());
}

/** Pede a permissao — no iPhone, so a partir de um toque — e inscreve. Devolve a permissao final. */
export async function ativarNotificacoes() {
  const permissao = await Notification.requestPermission();
  if (permissao === 'granted') await inscrever();
  return permissao;
}

/**
 * Ja permitido: garante a inscricao e manda de novo ao servidor, que atualiza
 * pelo endpoint. Cobre a inscricao que o navegador trocou sozinho.
 */
export async function renovarInscricao() {
  if (!suportaPush() || permissaoAtual() !== 'granted') return;
  try {
    await inscrever();
  } catch {
    // Sem rede ou sem service worker: tenta de novo na proxima abertura.
  }
}

/**
 * Ao sair da conta, ainda com a sessao valida: o backend apaga a inscricao e
 * o navegador a cancela. Sem isto, um iPhone emprestado continuaria recebendo
 * os avisos do filho de quem saiu. Sem rede, o cancelamento no navegador basta:
 * o proximo envio do backend recebe 410 e a linha e apagada la.
 */
export async function cancelarInscricao() {
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    const inscricao = await registro?.pushManager.getSubscription();
    if (!inscricao) return;
    await api.responsavel.removerPushWeb(inscricao.endpoint).catch(() => {});
    await inscricao.unsubscribe();
  } catch {
    // Sem inscricao, nada a cancelar.
  }
}
