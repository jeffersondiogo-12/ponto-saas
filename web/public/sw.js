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

/**
 * Notificacao com o app fechado (Web Push). O backend manda
 * `{ title, body, data }` (notificacoes.service.js › enviarWebPush), nos mesmos
 * pontos do app: passagem no equipamento, falta em sala e aviso.
 *
 * Todo push PRECISA virar notificacao visivel: o Chrome e o Safari cancelam a
 * inscricao de quem recebe push e nao mostra nada.
 */
self.addEventListener('push', (evento) => {
  let conteudo = {};
  try {
    conteudo = evento.data ? evento.data.json() : {};
  } catch {
    conteudo = { body: evento.data ? evento.data.text() : '' };
  }
  const dados = conteudo.data || {};
  evento.waitUntil(self.registration.showNotification(conteudo.title || 'Ponte Escolar', {
    body: conteudo.body || '',
    icon: '/icone-192.png',
    data: dados,
    // O mesmo aviso reenviado troca a notificacao, em vez de empilhar outra.
    tag: dados.avisoId ? `aviso-${dados.avisoId}` : undefined,
  }));
});

/**
 * Tocar na notificacao abre o app na tela certa. Passagem e falta levam a
 * ficha do filho (a falta, na aba Sala); aviso nao traz o filho no `data`, entao
 * leva a Home, onde o card mostra o aviso pendente.
 */
function destinoDaNotificacao(dados = {}) {
  if (dados.alunoId && dados.tipo === 'falta_sala') return `/filho/${dados.alunoId}?aba=sala`;
  if (dados.alunoId) return `/filho/${dados.alunoId}`;
  return '/';
}

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = new URL(destinoDaNotificacao(evento.notification.data), self.location.origin).href;
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const janela = janelas.find((item) => item.url.startsWith(self.location.origin));
    if (!janela) return self.clients.openWindow(url);
    try {
      await janela.navigate(url);
    } catch {
      // Janela que este worker nao controla: so traz para a frente.
    }
    return janela.focus();
  })());
});
