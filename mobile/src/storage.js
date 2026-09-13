import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache simples de "ultima resposta boa" por conta e chave de requisicao.
// So serve leituras: sempre tenta a rede primeiro (ver api.js); isso aqui e
// so o que sobra pra mostrar quando a rede falha.
const PREFIXO = '@ponto_saas_cache:v2:';
const PREFIXO_LEGADO = '@ponto_saas_cache:';
const CHAVE_MIGRACAO = '@ponto_saas_cache:v2:migrado';
const TTL_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

function chaveCache(namespace, chave) {
  return `${PREFIXO}${namespace}:${chave}`;
}

export async function migrarCacheLegado() {
  try {
    if (await AsyncStorage.getItem(CHAVE_MIGRACAO)) return;
    const chaves = await AsyncStorage.getAllKeys();
    const legadas = chaves.filter((chave) => chave.startsWith(PREFIXO_LEGADO) && !chave.startsWith(PREFIXO));
    if (legadas.length) await AsyncStorage.multiRemove(legadas);
    await AsyncStorage.setItem(CHAVE_MIGRACAO, '1');
  } catch {
    // A migracao sera tentada novamente na proxima leitura/gravação.
  }
}

export async function salvarCache(namespace, chave, dados) {
  if (!namespace) return;
  try {
    await migrarCacheLegado();
    await AsyncStorage.setItem(chaveCache(namespace, chave), JSON.stringify({ dados, em: Date.now() }));
  } catch {
    // Cache e so conveniencia - se o AsyncStorage falhar (device sem espaco,
    // etc.) a tela ainda funciona normalmente, so nao tera fallback offline.
  }
}

// Retorna { dados, em } ou null se nunca foi salvo.
export async function lerCache(namespace, chave) {
  if (!namespace) return null;
  try {
    await migrarCacheLegado();
    const bruto = await AsyncStorage.getItem(chaveCache(namespace, chave));
    if (!bruto) return null;
    const cache = JSON.parse(bruto);
    if (!cache.em || Date.now() - cache.em > TTL_CACHE_MS) {
      await AsyncStorage.removeItem(chaveCache(namespace, chave));
      return null;
    }
    return cache;
  } catch {
    return null;
  }
}

export async function limparCacheNamespace(namespace) {
  if (!namespace) return;
  try {
    const chaves = await AsyncStorage.getAllKeys();
    const prefixo = `${PREFIXO}${namespace}:`;
    const doNamespace = chaves.filter((chave) => chave.startsWith(prefixo));
    if (doNamespace.length) await AsyncStorage.multiRemove(doNamespace);
  } catch {
    // A limpeza sera tentada novamente no proximo logout.
  }
}
