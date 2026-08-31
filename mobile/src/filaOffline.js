import AsyncStorage from '@react-native-async-storage/async-storage';

// Fila de escritas que falharam por falta de rede (nao por rejeicao do
// servidor - ver a distincao em api.js). Cada item guarda o suficiente pra
// api.js conseguir repetir a chamada depois: caminho, metodo e corpo. Este
// modulo nao sabe nada sobre HTTP - so guarda e avisa quem esta ouvindo.
const CHAVE = '@ponto_saas_fila_offline';
const ouvintes = new Set();

function notificar(fila) {
  ouvintes.forEach((fn) => fn(fila));
}

// fn(fila) e chamada toda vez que a fila muda. Retorna a funcao pra parar de ouvir.
export function ouvirFila(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

async function lerFila() {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE);
    return bruto ? JSON.parse(bruto) : [];
  } catch {
    return [];
  }
}

async function salvarFila(fila) {
  try {
    await AsyncStorage.setItem(CHAVE, JSON.stringify(fila));
  } catch {
    // se nem isso salvar, a acao se perde - mas isso ja teria falhado antes
    // (AsyncStorage cheio ou indisponivel), entao nao ha muito mais a fazer.
  }
  notificar(fila);
}

export async function obterFila() {
  return lerFila();
}

// item: { rotulo (texto pro usuario), caminho, method, body }
export async function enfileirar(item) {
  const fila = await lerFila();
  const novoItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, criadoEm: Date.now(), ...item };
  fila.push(novoItem);
  await salvarFila(fila);
  return novoItem;
}

export async function removerDaFila(id) {
  const fila = await lerFila();
  await salvarFila(fila.filter((item) => item.id !== id));
}

export async function marcarFalhaNaFila(id, mensagem) {
  const fila = await lerFila();
  await salvarFila(fila.map((item) => (
    item.id === id
      ? { ...item, falhaDefinitiva: true, erro: mensagem, ultimaTentativaEm: Date.now() }
      : item
  )));
}

export async function reabrirNaFila(id) {
  const fila = await lerFila();
  await salvarFila(fila.map((item) => (
    item.id === id
      ? { ...item, falhaDefinitiva: false, erro: null, ultimaTentativaEm: null }
      : item
  )));
}
