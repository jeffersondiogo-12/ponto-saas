import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache simples de "ultima resposta boa" por chave (normalmente a URL da
// requisicao). So serve leituras: sempre tenta a rede primeiro (ver api.js);
// isso aqui e so o que sobra pra mostrar quando a rede falha.
const PREFIXO = '@ponto_saas_cache:';

export async function salvarCache(chave, dados) {
  try {
    await AsyncStorage.setItem(PREFIXO + chave, JSON.stringify({ dados, em: Date.now() }));
  } catch {
    // Cache e so conveniencia - se o AsyncStorage falhar (device sem espaco,
    // etc.) a tela ainda funciona normalmente, so nao tera fallback offline.
  }
}

// Retorna { dados, em } ou null se nunca foi salvo.
export async function lerCache(chave) {
  try {
    const bruto = await AsyncStorage.getItem(PREFIXO + chave);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}
