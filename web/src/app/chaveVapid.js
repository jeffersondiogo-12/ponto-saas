/** A chave VAPID vem em base64 de URL; o navegador quer os bytes. */
export function bytesDaChave(base64) {
  const completa = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob(completa.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bruto, (caractere) => caractere.charCodeAt(0));
}

/**
 * A inscricao do navegador foi feita com esta chave publica? Cada inscricao
 * fica presa a chave com que nasceu: se o par VAPID do servidor mudar, o
 * servico de push recusa o envio para as inscricoes antigas.
 *
 * Navegador que nao informa a chave usada (`options` ausente): considera que
 * sim, para nao refazer a inscricao a cada abertura.
 */
export function inscritaComChave(inscricao, chave) {
  const usada = inscricao?.options?.applicationServerKey;
  if (!usada) return true;
  const esperada = bytesDaChave(chave);
  const bytes = new Uint8Array(usada);
  return bytes.length === esperada.length && bytes.every((byte, indice) => byte === esperada[indice]);
}
