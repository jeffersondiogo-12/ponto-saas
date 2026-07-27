import AsyncStorage from '@react-native-async-storage/async-storage';

// Em desenvolvimento, aponte para o IP da sua maquina na rede local (nao
// "localhost" - no celular/emulador isso resolveria para o proprio
// dispositivo, nao para o computador rodando o backend). Em producao,
// aponte para o dominio real da API.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.10:3000';

const CHAVE_TOKEN = '@ponto_saas_responsavel_token';

export async function salvarToken(token) {
  await AsyncStorage.setItem(CHAVE_TOKEN, token);
}

export async function obterToken() {
  return AsyncStorage.getItem(CHAVE_TOKEN);
}

export async function limparToken() {
  await AsyncStorage.removeItem(CHAVE_TOKEN);
}

async function requisitar(caminho, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = await obterToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || `Erro ${resposta.status}`);
  }

  return dados;
}

export const api = {
  login: (email, senha) => requisitar('/api/responsaveis/login', { method: 'POST', body: { email, senha } }),
  cadastrar: (dados) => requisitar('/api/responsaveis/cadastro', { method: 'POST', body: dados }),
  listarAlunos: () => requisitar('/api/responsaveis/alunos'),
  frequenciaDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/frequencia`),
  registrarPushToken: (token, plataforma) =>
    requisitar('/api/responsaveis/push-token', { method: 'POST', body: { token, plataforma } }),
};
