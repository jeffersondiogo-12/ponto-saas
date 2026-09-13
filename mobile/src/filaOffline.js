import AsyncStorage from '@react-native-async-storage/async-storage';

// Fila de escritas namespaceada por identidade autenticada. Cada item guarda
// o suficiente para api.js repetir a chamada, mas nunca e lido fora da conta
// que o criou.
const PREFIXO = '@ponto_saas_fila_offline:v2:';
const CHAVE_LEGADA = '@ponto_saas_fila_offline';
const CHAVE_MIGRACAO = '@ponto_saas_fila_offline:v2:migrada';
const ouvintes = new Map();
const operacoes = new Map();

function chaveNamespace(namespace) {
  return `${PREFIXO}${encodeURIComponent(namespace)}`;
}

function notificar(namespace, fila) {
  (ouvintes.get(namespace) || []).forEach((fn) => fn(fila));
}

function executarEmOrdem(namespace, operacao) {
  const anterior = operacoes.get(namespace) || Promise.resolve();
  const atual = anterior.catch(() => {}).then(operacao);
  operacoes.set(namespace, atual.finally(() => {
    if (operacoes.get(namespace) === atual) operacoes.delete(namespace);
  }));
  return atual;
}

// fn(fila) e chamada toda vez que a fila muda. Retorna a funcao pra parar de ouvir.
export function ouvirFila(namespace, fn) {
  if (!namespace || typeof fn !== 'function') return () => {};
  const listeners = ouvintes.get(namespace) || [];
  listeners.push(fn);
  ouvintes.set(namespace, listeners);
  return () => {
    const atuais = (ouvintes.get(namespace) || []).filter((ouvinte) => ouvinte !== fn);
    if (atuais.length) ouvintes.set(namespace, atuais);
    else ouvintes.delete(namespace);
  };
}

async function migrarFilaLegada() {
  try {
    if (await AsyncStorage.getItem(CHAVE_MIGRACAO)) return;
    if (await AsyncStorage.getItem(CHAVE_LEGADA)) {
      // A fila antiga nao tem identidade confiavel e fica bloqueada para
      // evitar reenviar uma acao de outra conta com o token atual.
      await AsyncStorage.setItem(`${CHAVE_LEGADA}:bloqueada`, '1');
    }
    await AsyncStorage.setItem(CHAVE_MIGRACAO, '1');
  } catch {
    // Tenta novamente na proxima operacao.
  }
}

async function lerFila(namespace) {
  if (!namespace) return [];
  try {
    await migrarFilaLegada();
    const bruto = await AsyncStorage.getItem(chaveNamespace(namespace));
    return bruto ? JSON.parse(bruto) : [];
  } catch {
    return [];
  }
}

async function salvarFila(namespace, fila) {
  if (!namespace) throw new Error('Fila offline sem identidade autenticada.');
  await AsyncStorage.setItem(chaveNamespace(namespace), JSON.stringify(fila));
  notificar(namespace, fila);
}

export async function obterFila(namespace) {
  return lerFila(namespace);
}

// item: { rotulo (texto pro usuario), caminho, method, body }
export async function enfileirar(namespace, item) {
  if (!namespace) throw new Error('Nao e possivel enfileirar sem identidade autenticada.');
  return executarEmOrdem(namespace, async () => {
    const fila = await lerFila(namespace);
    const novoItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      criadoEm: Date.now(),
      ...item,
      namespace,
    };
    fila.push(novoItem);
    await salvarFila(namespace, fila);
    return novoItem;
  });
}

export async function removerDaFila(namespace, id) {
  return executarEmOrdem(namespace, async () => {
    const fila = await lerFila(namespace);
    await salvarFila(namespace, fila.filter((item) => item.id !== id));
  });
}

export async function marcarFalhaNaFila(namespace, id, mensagem) {
  return executarEmOrdem(namespace, async () => {
    const fila = await lerFila(namespace);
    await salvarFila(namespace, fila.map((item) => (
      item.id === id
        ? { ...item, falhaDefinitiva: true, erro: mensagem, ultimaTentativaEm: Date.now() }
        : item
    )));
  });
}

export async function reabrirNaFila(namespace, id) {
  return executarEmOrdem(namespace, async () => {
    const fila = await lerFila(namespace);
    await salvarFila(namespace, fila.map((item) => (
      item.id === id
        ? { ...item, falhaDefinitiva: false, erro: null, ultimaTentativaEm: null }
        : item
    )));
  });
}

export async function limparFilaNamespace(namespace) {
  if (!namespace) return;
  return executarEmOrdem(namespace, async () => {
    await AsyncStorage.removeItem(chaveNamespace(namespace));
    notificar(namespace, []);
  });
}

export async function obterFilaLegada() {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_LEGADA);
    return bruto ? JSON.parse(bruto) : [];
  } catch {
    return [];
  }
}

export async function limparFilaLegada() {
  await AsyncStorage.multiRemove([CHAVE_LEGADA, `${CHAVE_LEGADA}:bloqueada`]);
}
