const { ORIGEM_OFICIAL, resolverOrigem } = require('../src/config/rede');

function validarPerfil({ perfil, url, permitirProducaoEmDev = false }) {
  if (!['development', 'preview', 'production'].includes(perfil)) {

    throw new Error('Perfil EAS desconhecido. Use development, preview ou production.');
  }

  const origem = resolverOrigem({
    valor: url,
    desenvolvimento: perfil === 'development',
    permitirProducaoEmDev,
  });
  if (perfil !== 'development' && origem !== ORIGEM_OFICIAL) {
    throw new Error(`O perfil ${perfil} deve usar a URL oficial configurada no mobile.`);
  }
  return origem;
}

if (require.main === module) {
  try {
    const perfil = process.env.EAS_BUILD_PROFILE;
    const origem = validarPerfil({
      perfil,
      url: process.env.EXPO_PUBLIC_API_URL,
      permitirProducaoEmDev: process.env.EXPO_PUBLIC_ALLOW_PRODUCTION_API_IN_DEV === 'true',
    });
    console.log(`[rede] Perfil ${perfil}: ${origem}`);
  } catch (erro) {
    console.error(`[rede] Configuração inválida: ${erro.message}`);
    process.exitCode = 1;
  }
}

module.exports = { validarPerfil };
