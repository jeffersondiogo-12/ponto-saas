import AsyncStorage from '@react-native-async-storage/async-storage';

// Em desenvolvimento, aponte para o IP da sua maquina na rede local (nao
// "localhost" - no celular/emulador isso resolveria para o proprio
// dispositivo, nao para o computador rodando o backend). Em producao,
// aponte para o dominio real da API.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.10:3000';

const CHAVE_TIPO_SESSAO = '@ponto_saas_tipo_sessao';
const CHAVE_TOKEN_RESPONSAVEL = '@ponto_saas_responsavel_token';
const CHAVE_TOKEN_PROFESSOR = '@ponto_saas_professor_token';

export async function salvarTipoSessao(tipo) {
  if (!tipo) {
    await AsyncStorage.removeItem(CHAVE_TIPO_SESSAO);
    return;
  }
  await AsyncStorage.setItem(CHAVE_TIPO_SESSAO, tipo);
}

export async function obterTipoSessao() {
  return AsyncStorage.getItem(CHAVE_TIPO_SESSAO);
}

export async function salvarToken(token, tipo = 'responsavel') {
  const chave = tipo === 'professor' ? CHAVE_TOKEN_PROFESSOR : CHAVE_TOKEN_RESPONSAVEL;
  await AsyncStorage.setItem(chave, token);
}

export async function obterToken(tipo = 'responsavel') {
  const chave = tipo === 'professor' ? CHAVE_TOKEN_PROFESSOR : CHAVE_TOKEN_RESPONSAVEL;
  return AsyncStorage.getItem(chave);
}

export async function limparToken(tipo = 'responsavel') {
  const chave = tipo === 'professor' ? CHAVE_TOKEN_PROFESSOR : CHAVE_TOKEN_RESPONSAVEL;
  await AsyncStorage.removeItem(chave);
}

async function requisitar(caminho, { method = 'GET', body, tipo = 'responsavel' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = await obterToken(tipo);
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
  login: (email, senha) => requisitar('/api/responsaveis/login', { method: 'POST', body: { email, senha }, tipo: 'responsavel' }),
  loginProfessor: (email, senha) => requisitar('/api/professores/login', { method: 'POST', body: { email, senha }, tipo: 'professor' }),
  cadastrar: (dados) => requisitar('/api/responsaveis/cadastro', { method: 'POST', body: dados, tipo: 'responsavel' }),
  listarAlunos: () => requisitar('/api/responsaveis/alunos', { tipo: 'responsavel' }),
  frequenciaDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/frequencia`, { tipo: 'responsavel' }),
  registrarPushToken: (token, plataforma) =>
    requisitar('/api/responsaveis/push-token', { method: 'POST', body: { token, plataforma }, tipo: 'responsavel' }),
  listarTurmasProfessor: () => requisitar('/api/professores/me/turmas', { tipo: 'professor' }),
  listarChamadaProfessor: ({ turma_id, data }) => requisitar(`/api/chamadas/alunos?turma_id=${turma_id}&data=${data}`, { tipo: 'professor' }),
  salvarChamadaProfessor: ({ turma_id, data, presencas }) => requisitar('/api/chamadas/salvar', {
    method: 'POST',
    body: { turma_id, data, presencas },
    tipo: 'professor',
  }),
};
