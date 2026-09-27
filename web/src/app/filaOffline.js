// Fila de acoes feitas sem internet, na cara do app (PWA). Porte de
// mobile/src/filaOffline.js: mesma forma de item, mesma separacao por conta.
// Cada item guarda o suficiente para o api.js repetir a chamada, e nunca e
// lido fora da conta que o criou.
//
// Diferenca do APK: o localStorage do navegador e sincrono, entao as funcoes
// aqui tambem sao — e a ordem das inclusoes nao precisa de fila de promessas.
const PREFIXO = 'ponto_saas_fila_offline:v1:';
const ouvintes = new Map();

function chave(namespace) {
  return `${PREFIXO}${encodeURIComponent(namespace)}`;
}

function ler(namespace) {
  if (!namespace) return [];
  try {
    return JSON.parse(localStorage.getItem(chave(namespace))) || [];
  } catch {
    return [];
  }
}

function salvar(namespace, fila) {
  localStorage.setItem(chave(namespace), JSON.stringify(fila));
  (ouvintes.get(namespace) || []).forEach((fn) => fn(fila));
}

function trocar(namespace, id, mudanca) {
  salvar(namespace, ler(namespace).map((item) => (item.id === id ? { ...item, ...mudanca } : item)));
}

/** fn(fila) a cada mudanca da fila desta conta. Devolve a funcao para parar. */
export function ouvirFila(namespace, fn) {
  if (!namespace) return () => {};
  ouvintes.set(namespace, [...(ouvintes.get(namespace) || []), fn]);
  return () => ouvintes.set(namespace, (ouvintes.get(namespace) || []).filter((ouvinte) => ouvinte !== fn));
}

export function obterFila(namespace) {
  return ler(namespace);
}

/** item: { rotulo (texto para a pessoa), caminho, method, body } */
export function enfileirar(namespace, item) {
  if (!namespace) throw new Error('Não é possível guardar a ação sem uma conta conectada.');
  const novo = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    criadoEm: Date.now(),
    ...item,
    namespace,
  };
  salvar(namespace, [...ler(namespace), novo]);
  return novo;
}

export function removerDaFila(namespace, id) {
  salvar(namespace, ler(namespace).filter((item) => item.id !== id));
}

/** O servidor recusou: o item fica visivel para a pessoa corrigir ou tentar de novo. */
export function marcarFalhaNaFila(namespace, id, mensagem) {
  trocar(namespace, id, { falhaDefinitiva: true, erro: mensagem, ultimaTentativaEm: Date.now() });
}

export function reabrirNaFila(namespace, id) {
  trocar(namespace, id, { falhaDefinitiva: false, erro: null, ultimaTentativaEm: null });
}

export function limparFila(namespace) {
  if (!namespace) return;
  localStorage.removeItem(chave(namespace));
  (ouvintes.get(namespace) || []).forEach((fn) => fn([]));
}
