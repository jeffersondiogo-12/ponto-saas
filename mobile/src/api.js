import AsyncStorage from '@react-native-async-storage/async-storage';

// Em desenvolvimento, aponte para o IP da sua maquina na rede local (nao
// "localhost" - no celular/emulador isso resolveria para o proprio
// dispositivo, nao para o computador rodando o backend). Em producao,
// aponte para o dominio real da API.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.10:3000';

const CHAVE_TOKEN = '@ponto_saas_responsavel_token';
const PREFIXO_CACHE = '@ponto_saas_cache:';
const CHAVE_PENDENCIAS = '@ponto_saas_pendencias';

export async function salvarToken(token) {
  await AsyncStorage.setItem(CHAVE_TOKEN, token);
}

export async function obterToken() {
  return AsyncStorage.getItem(CHAVE_TOKEN);
}

export async function limparToken() {
  await AsyncStorage.removeItem(CHAVE_TOKEN);
}

async function lerCache(chave) {
  if (!chave) return null;
  const valor = await AsyncStorage.getItem(`${PREFIXO_CACHE}${chave}`);
  return valor ? JSON.parse(valor) : null;
}

async function salvarCache(chave, dados) {
  if (chave) await AsyncStorage.setItem(`${PREFIXO_CACHE}${chave}`, JSON.stringify(dados));
}

export async function limparCache() {
  const chaves = await AsyncStorage.getAllKeys();
  const antigas = chaves.filter((chave) => chave.startsWith(PREFIXO_CACHE));
  if (antigas.length) await AsyncStorage.multiRemove(antigas);
}

async function adicionarPendencia(caminho, body) {
  const pendencias = JSON.parse((await AsyncStorage.getItem(CHAVE_PENDENCIAS)) || '[]');
  pendencias.push({ caminho, body });
  await AsyncStorage.setItem(CHAVE_PENDENCIAS, JSON.stringify(pendencias));
}

export async function sincronizarPendencias() {
  const pendencias = JSON.parse((await AsyncStorage.getItem(CHAVE_PENDENCIAS)) || '[]');
  const restantes = [];
  for (const pendencia of pendencias) {
    try {
      await requisitar(pendencia.caminho, { method: 'POST', body: pendencia.body, enfileirar: false });
    } catch (err) {
      restantes.push(pendencia);
    }
  }
  await AsyncStorage.setItem(CHAVE_PENDENCIAS, JSON.stringify(restantes));
  return restantes.length;
}

async function requisitar(caminho, { method = 'GET', body, cacheKey, enfileirar = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = await obterToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
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
    if (method === 'GET') await salvarCache(cacheKey, dados);
    return dados;
  } catch (err) {
    if (method === 'GET' && !err.status) {
      const cache = await lerCache(cacheKey);
      if (cache) return { ...cache, offline: true };
    }
    if (enfileirar && !err.status) {
      await adicionarPendencia(caminho, body);
      return { offline: true, enfileirada: true };
    }
    throw err;
  }
}

export const api = {
  login: (email, senha) => requisitar('/api/responsaveis/login', { method: 'POST', body: { email, senha } }),
  loginProfessor: (email, senha, unidade) => requisitar('/api/auth/login', { method: 'POST', body: { email, senha, unidade } }),
  cadastrar: (dados) => requisitar('/api/responsaveis/cadastro', { method: 'POST', body: dados }),
  listarAlunos: () => requisitar('/api/responsaveis/alunos', { cacheKey: 'alunos' }),
  vincularFilho: (dados) => requisitar('/api/responsaveis/alunos/vincular', { method: 'POST', body: dados, enfileirar: true }),
  frequenciaDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/frequencia`, { cacheKey: `frequencia:${alunoId}` }),
  painelDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/painel`, { cacheKey: `painel:${alunoId}` }),
  registrarPushToken: (token, plataforma) =>
    requisitar('/api/responsaveis/push-token', { method: 'POST', body: { token, plataforma } }),
  listarMinhasTurmas: () => requisitar('/api/professores/minhas-turmas', { cacheKey: 'professor:turmas' }),
  listarAlunosDaTurma: (turmaId) => requisitar(`/api/professores/turmas/${turmaId}/alunos`, { cacheKey: `professor:alunos:${turmaId}` }),
  registrarPresencasSala: (turmaId, dados) => requisitar(`/api/professores/turmas/${turmaId}/presencas`, { method: 'POST', body: dados, enfileirar: true }),
  criarNotaProfessor: (turmaId, dados) => requisitar(`/api/professores/turmas/${turmaId}/notas`, { method: 'POST', body: dados, enfileirar: true }),
  criarObservacaoProfessor: (turmaId, dados) => requisitar(`/api/professores/turmas/${turmaId}/observacoes`, { method: 'POST', body: dados, enfileirar: true }),
};
