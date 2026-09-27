import { api } from '../api';
import { ehIos, instalado } from './instalacao';

/**
 * Notificacao com o app fechado (Web Push), so para o responsavel — como no
 * APK. O backend guarda a inscricao (`POST /api/responsaveis/push-web`) e
 * envia pelo web-push nos mesmos pontos do Expo: passagem no equipamento,
 * falta em sala e aviso. Quem mostra a notificacao e o `public/sw.js`.
 */
const CHAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/** A chave VAPID vem em base64 de URL; o navegador quer os bytes. */
function bytesDaChave(base64) {
  const completa = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob(completa.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bruto, (caractere) => caractere.charCodeAt(0));
}

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
  const inscricao = await registro.pushManager.getSubscription()
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
 * Ao sair da conta: o navegador cancela a inscricao, o proximo envio do
 * backend recebe 410 e a linha e apagada. Sem isto, um iPhone emprestado
 * continuaria recebendo os avisos do filho de quem saiu.
 */
export async function cancelarInscricao() {
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    const inscricao = await registro?.pushManager.getSubscription();
    await inscricao?.unsubscribe();
  } catch {
    // Sem inscricao, nada a cancelar.
  }
}
