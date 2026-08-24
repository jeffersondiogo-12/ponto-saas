import AsyncStorage from '@react-native-async-storage/async-storage';

// Em desenvolvimento, aponte para o IP da sua maquina na rede local (nao
// "localhost" - no celular/emulador isso resolveria para o proprio
// dispositivo, nao para o computador rodando o backend). Em producao,
// aponte para o dominio real da API.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.10:3000';

const CHAVE_TOKEN = '@ponto_saas_responsavel_token';
const CHAVE_SESSAO = '@ponto_saas_sessao';

export async function salvarToken(token) {
  await AsyncStorage.setItem(CHAVE_TOKEN, token);
}

export async function obterToken() {
  return AsyncStorage.getItem(CHAVE_TOKEN);
}

export async function limparToken() {
  await AsyncStorage.removeItem(CHAVE_TOKEN);
}

// Nao existe endpoint "/me" no backend - o unico jeito de saber quem esta
// logado (responsavel ou professor) ao reabrir o app e guardar aqui o
// mesmo objeto que o login devolveu, e reler no boot (ver AuthContext.js).
export async function salvarSessao(usuario) {
  await AsyncStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario));
}

export async function obterSessao() {
  const bruto = await AsyncStorage.getItem(CHAVE_SESSAO);
  return bruto ? JSON.parse(bruto) : null;
}

export async function limparSessao() {
  await AsyncStorage.removeItem(CHAVE_SESSAO);
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
    const erro = new Error(dados.erro || `Erro ${resposta.status}`);
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}

export const api = {
  // --- Responsável ---
  login: (email, senha) => requisitar('/api/responsaveis/login', { method: 'POST', body: { email, senha } }),
  cadastrar: (dados) => requisitar('/api/responsaveis/cadastro', { method: 'POST', body: dados }),
  listarAlunos: () => requisitar('/api/responsaveis/alunos'),
  frequenciaDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/frequencia`),
  notasDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/notas`),
  observacoesDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/observacoes`),
  registrarPushToken: (token, plataforma) =>
    requisitar('/api/responsaveis/push-token', { method: 'POST', body: { token, plataforma } }),

  // --- Professor (login de staff — exige a empresa/ambiente, igual ao web) ---
  loginProfessor: (email, senha, unidade) =>
    requisitar('/api/auth/login', { method: 'POST', body: { email, senha, unidade } }),
  listarMinhasTurmas: () => requisitar('/api/professores/minhas-turmas'),
  listarAlunosDaTurma: (turmaId) => requisitar(`/api/professores/turmas/${turmaId}/alunos`),
  registrarPresencasSala: (turmaId, dados) =>
    requisitar(`/api/professores/turmas/${turmaId}/presencas`, { method: 'POST', body: dados }),
  criarNotaProfessor: (turmaId, dados) =>
    requisitar(`/api/professores/turmas/${turmaId}/notas`, { method: 'POST', body: dados }),
  criarObservacaoProfessor: (turmaId, dados) =>
    requisitar(`/api/professores/turmas/${turmaId}/observacoes`, { method: 'POST', body: dados }),
  historicoDoAluno: (turmaId, alunoId) =>
    requisitar(`/api/professores/turmas/${turmaId}/alunos/${alunoId}/historico`),
};
