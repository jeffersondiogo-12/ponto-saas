/**
 * Service worker do Ponte Escolar.
 *
 * REGRA QUE NAO SE NEGOCIA: **nada de API entra no cache.**
 *
 * Este sistema mostra registro de ponto e presenca de crianca. Servir uma
 * resposta velha aqui e pior do que nao abrir: alguem olharia a tela, veria a
 * entrada do filho registrada, e o dado seria de ontem. Cache so do casco —
 * HTML, CSS, JS e imagem —, que e o que faz o aplicativo abrir.
 *
 * Por isso o `fetch` abaixo so responde a navegacao e a arquivos do proprio
 * site. Requisicao para outra origem (a API mora em outro dominio) nem passa
 * por aqui: cai no `return` de saida e segue para a rede como sempre.
 */

const VERSAO = 'ponte-escolar-v1';
const CASCO = ['/', '/index.html', '/ponte-escolar.png', '/favicon-32.png', '/apple-touch-icon.png'];

self.addEventListener('install', (evento) => {
  // `addAll` falha inteiro se um arquivo faltar; os do casco sao poucos e
  // conhecidos, mas o catch evita um worker que nunca instala se algum sair.
  evento.waitUntil(
    caches.open(VERSAO)
      .then((cache) => cache.addAll(CASCO))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves.filter((chave) => chave !== VERSAO).map((chave) => caches.delete(chave)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Outra origem = a API. Nunca intercepta.
  if (url.origin !== self.location.origin) return;
  // Cinto e suspensorio: se um dia a API passar a morar no mesmo dominio.
  if (url.pathname.startsWith('/api/')) return;

  /**
   * Navegacao: rede primeiro, cache so quando a rede falha.
   *
   * O contrario (cache primeiro) faria o aplicativo abrir na versao antiga
   * depois de cada publicacao, ate alguem limpar os dados do site.
   */
  if (request.mode === 'navigate') {
    evento.respondWith(
      fetch(request)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(VERSAO).then((cache) => cache.put('/index.html', copia));
          return resposta;
        })
        .catch(() => caches.match('/index.html').then((cacheada) => cacheada || Response.error())),
    );
    return;
  }

  /**
   * Arquivos do build: cache primeiro, porque o Vite carimba o hash no nome
   * (`index-CcBWiwbR.js`). Publicacao nova gera nome novo, entao nao existe
   * versao velha servida por engano — o arquivo antigo simplesmente deixa de
   * ser pedido.
   */
  evento.respondWith(
    caches.match(request).then((cacheada) => cacheada || fetch(request).then((resposta) => {
      if (resposta.ok && resposta.type === 'basic') {
        const copia = resposta.clone();
        caches.open(VERSAO).then((cache) => cache.put(request, copia));
      }
      return resposta;
    })),
  );
});
