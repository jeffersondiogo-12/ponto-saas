// Ultima resposta boa de cada leitura, por conta. Porte de mobile/src/storage.js.
//
// EXCECAO a regra do service worker ("nada de API em cache"), aberta pelo
// Samuel em 2026-09-26 SO PARA O PROFESSOR: sem a lista de alunos guardada, a
// chamada nao abre sem internet. Continua valendo o motivo da regra — dado
// velho nao pode se passar por atual —, por isso a tela sempre diz de quando
// sao os dados (FaixaEstado) e o cache vence em 7 dias. Quem decide o que entra
// aqui e a chamada com `cache: true` no api.js; responsavel e administracao
// nao usam.
const PREFIXO = 'ponto_saas_cache:v1:';
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

function chave(namespace, caminho) {
  return `${PREFIXO}${encodeURIComponent(namespace)}:${caminho}`;
}

export function salvarCache(namespace, caminho, dados) {
  if (!namespace) return;
  try {
    localStorage.setItem(chave(namespace, caminho), JSON.stringify({ dados, em: Date.now() }));
  } catch {
    // Sem espaco: a tela funciona igual, so nao tera o que mostrar sem rede.
  }
}

/** { dados, em } ou null se nunca foi salvo ou venceu. */
export function lerCache(namespace, caminho) {
  if (!namespace) return null;
  try {
    const cache = JSON.parse(localStorage.getItem(chave(namespace, caminho)));
    if (!cache?.em || Date.now() - cache.em > VALIDADE_MS) {
      localStorage.removeItem(chave(namespace, caminho));
      return null;
    }
    return cache;
  } catch {
    return null;
  }
}

export function limparCache(namespace) {
  if (!namespace) return;
  const prefixo = `${PREFIXO}${encodeURIComponent(namespace)}:`;
  Object.keys(localStorage)
    .filter((k) => k.startsWith(prefixo))
    .forEach((k) => localStorage.removeItem(k));
}
