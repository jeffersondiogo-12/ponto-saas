// Jest não carrega o .env do Expo. As requisições HTTP são simuladas nos testes.
process.env.EXPO_PUBLIC_API_URL = 'https://ponto-saas-u8zf.onrender.com';
process.env.EXPO_PUBLIC_ALLOW_PRODUCTION_API_IN_DEV = 'true';
