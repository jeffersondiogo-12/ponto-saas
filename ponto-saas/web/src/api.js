const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const CHAVE_TOKEN = 'ponto_saas_token';
const CHAVE_EMPRESA_ID = 'ponto_saas_empresa_id';
const CHAVE_EMPRESA_NOME = 'ponto_saas_empresa_nome';
const CHAVE_FILIAL_ID = 'ponto_saas_filial_id';
const CHAVE_FILIAL_NOME = 'ponto_saas_filial_nome';
const CHAVE_FILIAL_TIPO = 'ponto_saas_filial_tipo';

function obterToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

export function salvarToken(token) {
  localStorage.setItem(CHAVE_TOKEN, token);
}

export function limparToken() {
  localStorage.removeItem(CHAVE_TOKEN);
}

export function obterEmpresaSelecionada() {
  const id = localStorage.getItem(CHAVE_EMPRESA_ID);
  const nome = localStorage.getItem(CHAVE_EMPRESA_NOME);
  return id ? { id, nome: nome || '' } : null;
}

export function salvarEmpresaSelecionada({ id, nome }) {
  localStorage.setItem(CHAVE_EMPRESA_ID, id);
  localStorage.setItem(CHAVE_EMPRESA_NOME, nome || '');
}

export function limparEmpresaSelecionada() {
  localStorage.removeItem(CHAVE_EMPRESA_ID);
  localStorage.removeItem(CHAVE_EMPRESA_NOME);
}

export function obterFilialSelecionada() {
  const id = localStorage.getItem(CHAVE_FILIAL_ID);
  const nome = localStorage.getItem(CHAVE_FILIAL_NOME);
  const tipo = localStorage.getItem(CHAVE_FILIAL_TIPO);
  return id ? { id, nome: nome || '', tipo: tipo || 'empresa' } : null;
}

export function salvarFilialSelecionada({ id, nome, tipo }) {
  localStorage.setItem(CHAVE_FILIAL_ID, id);
  localStorage.setItem(CHAVE_FILIAL_NOME, nome || '');
  localStorage.setItem(CHAVE_FILIAL_TIPO, tipo || 'empresa');
}

export function limparFilialSelecionada() {
  localStorage.removeItem(CHAVE_FILIAL_ID);
  localStorage.removeItem(CHAVE_FILIAL_NOME);
  localStorage.removeItem(CHAVE_FILIAL_TIPO);
}

async function requisitar(caminho, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = obterToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const empresaSelecionada = obterEmpresaSelecionada();
  if (empresaSelecionada) {
    headers['X-Empresa-Id'] = empresaSelecionada.id;
  }

  const filialSelecionada = obterFilialSelecionada();
  if (filialSelecionada) {
    headers['X-Filial-Id'] = filialSelecionada.id;
  }

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
  login: (email, senha, unidade) => requisitar('/api/auth/login', { method: 'POST', body: { email, senha, unidade } }),
  loginProfessor: (email, senha) => requisitar('/api/professores/login', { method: 'POST', body: { email, senha } }),
  listarTurmasProfessor: (token) => fetch(`${BASE_URL}/api/professores/me/turmas`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (res) => {
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(dados.erro || `Erro ${res.status}`);
    return dados;
  }),
  listarChamadaProfessor: ({ turma_id, data }) => fetch(`${BASE_URL}/api/chamadas/alunos?turma_id=${turma_id}&data=${data}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('ponto_saas_professor_token')}` },
  }).then(async (res) => {
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(dados.erro || `Erro ${res.status}`);
    return dados;
  }),
  salvarChamadaProfessor: ({ turma_id, data, presencas }) => fetch(`${BASE_URL}/api/chamadas/salvar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('ponto_saas_professor_token')}`,
    },
    body: JSON.stringify({ turma_id, data, presencas }),
  }).then(async (res) => {
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(dados.erro || `Erro ${res.status}`);
    return dados;
  }),

  listarEmpresas: () => requisitar('/api/empresas'),

  listarDispositivos: () => requisitar('/api/dispositivos'),
  buscarDispositivo: (id) => requisitar(`/api/dispositivos/${id}`),
  criarDispositivo: (dados) => requisitar('/api/dispositivos', { method: 'POST', body: dados }),
  atualizarDispositivo: (id, dados) => requisitar(`/api/dispositivos/${id}`, { method: 'PUT', body: dados }),
  testarConexaoDispositivo: (id) => requisitar(`/api/dispositivos/${id}/testar-conexao`, { method: 'POST' }),
  forcarColeta: (id) => requisitar(`/api/dispositivos/${id}/forcar-coleta`, { method: 'POST' }),

  listarUnidades: () => requisitar('/api/filiais'),
  buscarUnidade: (id) => requisitar(`/api/filiais/${id}`),
  criarUnidade: (dados) => requisitar('/api/filiais', { method: 'POST', body: dados }),
  atualizarUnidade: (id, dados) => requisitar(`/api/filiais/${id}`, { method: 'PUT', body: dados }),
  listarTurmas: () => requisitar('/api/turmas'),

  listarFuncionarios: () => requisitar('/api/funcionarios'),
  listarAlunos: () => requisitar('/api/alunos'),
  criarAluno: (dados) => requisitar('/api/alunos', { method: 'POST', body: dados }),
  listarUsuarios: () => requisitar('/api/auth/usuarios'),
  criarUsuario: (dados) => requisitar('/api/auth/usuarios', { method: 'POST', body: dados }),
  listarRegistrosNaoResolvidos: () => requisitar('/api/ponto/registros/nao-resolvidos'),
};
