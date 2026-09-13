// CommonJS permite usar a mesma validação no aplicativo e no pré-build do EAS.
const ORIGEM_OFICIAL = 'https://ponto-saas-u8zf.onrender.com';

function erroConfiguracao(mensagem) {
  const erro = new Error(mensagem);
  erro.codigo = 'CONFIG_REDE';
  return erro;
}

function resolverOrigem({ valor, desenvolvimento = false, permitirProducaoEmDev = false } = {}) {
  if (!valor || typeof valor !== 'string' || !valor.trim()) {
    throw erroConfiguracao('EXPO_PUBLIC_API_URL não configurada. Informe a origem HTTP(S) da API.');
  }

  let url;
  try {
    url = new URL(valor.trim());
  } catch {
    throw erroConfiguracao('EXPO_PUBLIC_API_URL inválida. Use uma URL HTTP(S) completa.');
  }

  if (!['http:', 'https:'].includes(url.protocol)
    || !url.hostname
    || url.username || url.password || url.search || url.hash
    || (url.pathname !== '/' && url.pathname !== '')) {
    throw erroConfiguracao('EXPO_PUBLIC_API_URL deve conter somente protocolo, host e porta opcional; não inclua /api, /ws, credenciais ou parâmetros.');
  }

  const origem = url.origin;
  if (desenvolvimento && origem === ORIGEM_OFICIAL && !permitirProducaoEmDev) {
    throw erroConfiguracao('API de produção bloqueada no desenvolvimento. Para usá-la intencionalmente, defina EXPO_PUBLIC_ALLOW_PRODUCTION_API_IN_DEV=true.');
  }
  return origem;
}


function obterOrigemApi() {
  return resolverOrigem({

    
    valor: process.env.EXPO_PUBLIC_API_URL,
    desenvolvimento: typeof __DEV__ !== 'undefined' && __DEV__,
    permitirProducaoEmDev: process.env.EXPO_PUBLIC_ALLOW_PRODUCTION_API_IN_DEV === 'true',
  });
}

function criarUrlWebSocket(token) {
  if (!token) throw erroConfiguracao('Token ausente para conexão em tempo real.');
  const origem = obterOrigemApi();
  const protocolo = origem.startsWith('https://') ? 'wss://' : 'ws://';
  return `${protocolo}${origem.replace(/^https?:\/\//, '')}/ws?token=${encodeURIComponent(token)}`;
}

module.exports = { ORIGEM_OFICIAL, resolverOrigem, obterOrigemApi, criarUrlWebSocket };
