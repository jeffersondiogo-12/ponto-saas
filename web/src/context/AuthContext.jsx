import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  api,
  salvarToken,
  limparToken,
  obterToken,
  obterEmpresaSelecionada,
  salvarEmpresaSelecionada,
  limparEmpresaSelecionada,
  obterFilialSelecionada,
  salvarFilialSelecionada,
  limparFilialSelecionada,
} from '../api';
import { normalizarPermissoes, pode as podeNaMatriz, ehSuperAdmin } from '../utils/permissoes';

const AuthContext = createContext(null);

const CHAVE_PERMISSOES = 'ponto_saas_permissoes';

function lerUsuarioSalvo() {
  const bruto = localStorage.getItem('ponto_saas_usuario');
  return bruto ? JSON.parse(bruto) : null;
}

/**
 * A matriz fica no localStorage para o menu nao piscar entre o F5 e a resposta
 * da API. E cache de conveniencia, nao fonte de verdade: o servidor confere
 * cada rota de novo, entao uma copia velha aqui mostra um botao a mais, nunca
 * concede acesso.
 */
function lerPermissoesSalvas() {
  try {
    const bruto = localStorage.getItem(CHAVE_PERMISSOES);
    return bruto ? normalizarPermissoes(JSON.parse(bruto)) : {};
  } catch {
    return {};
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(lerUsuarioSalvo);
  const [empresaSelecionada, setEmpresaSelecionada] = useState(obterEmpresaSelecionada);
  const [filialSelecionada, setFilialSelecionada] = useState(obterFilialSelecionada);
  const [permissoes, setPermissoes] = useState(lerPermissoesSalvas);

  const carregarPermissoes = useCallback(async () => {
    if (!usuario) { setPermissoes({}); return; }
    // `/api/permissoes` passa por resolverTenant: sem empresa escolhida, o
    // super_admin leva 400. Ele nao precisa da matriz de qualquer forma —
    // `pode()` ja o deixa passar, igual ao middleware do servidor.
    if (ehSuperAdmin(usuario) && !empresaSelecionada) return;
    try {
      const r = await api.listarPermissoes();
      const lista = r.permissoes || [];
      localStorage.setItem(CHAVE_PERMISSOES, JSON.stringify(lista));
      setPermissoes(normalizarPermissoes(lista));
    } catch {
      /**
       * Falhou: MANTEM o que ja estava (o cache do localStorage), em vez de
       * zerar. Zerar apaga o menu inteiro a cada instabilidade de rede — e a
       * pessoa fica olhando um sistema vazio sem entender por que.
       *
       * Manter e seguro: isto nao e a trava. Cada rota e conferida de novo no
       * servidor por `exigirPermissao`, entao uma matriz velha aqui mostra no
       * maximo um botao a mais, que levaria 403 ao ser clicado. Nunca concede
       * acesso.
       *
       * A matriz so e zerada no logout, que e quando ela realmente deixa de
       * valer.
       */
    }
  }, [usuario, empresaSelecionada]);

  useEffect(() => { carregarPermissoes(); }, [carregarPermissoes]);

  const login = useCallback(async (email, senha, unidade) => {
    const resposta = await api.login(email, senha, unidade);
    const { token, usuario: dadosUsuario, empresaSelecionada, filialSelecionada } = resposta;

    salvarToken(token);
    localStorage.setItem('ponto_saas_usuario', JSON.stringify(dadosUsuario));
    setUsuario(dadosUsuario);

    if (empresaSelecionada) {
      salvarEmpresaSelecionada(empresaSelecionada);
      setEmpresaSelecionada(empresaSelecionada);
    } else if (dadosUsuario.papel !== 'super_admin') {
      limparEmpresaSelecionada();
      setEmpresaSelecionada(null);
    }

    if (filialSelecionada) {
      salvarFilialSelecionada(filialSelecionada);
      setFilialSelecionada(filialSelecionada);
    } else {
      limparFilialSelecionada();
      setFilialSelecionada(null);
    }

    return resposta;
  }, []);

  const selecionarEmpresa = useCallback(({ id, nome }) => {
    salvarEmpresaSelecionada({ id, nome });
    setEmpresaSelecionada({ id, nome });
  }, []);

  const selecionarFilial = useCallback(({ id, nome, tipo }) => {
    salvarFilialSelecionada({ id, nome, tipo });
    setFilialSelecionada({ id, nome, tipo });
  }, []);

  const limparEmpresa = useCallback(() => {
    limparEmpresaSelecionada();
    limparFilialSelecionada();
    setEmpresaSelecionada(null);
    setFilialSelecionada(null);
  }, []);

  const logout = useCallback(() => {
    limparToken();
    localStorage.removeItem('ponto_saas_usuario');
    localStorage.removeItem(CHAVE_PERMISSOES);
    limparEmpresa();
    setPermissoes({});
    setUsuario(null);
  }, [limparEmpresa]);

  /**
   * Sessao morta (401 com token) derruba para o login. O evento vem do
   * `requisitar` em `api.js`, que e por onde toda chamada passa — nenhuma tela
   * precisa saber disso.
   */
  useEffect(() => {
    const aoEncerrar = () => {
      // So na queda, nao no logout normal: quem clicou em "Sair" sabe por que
      // esta vendo a tela de login.
      try {
        sessionStorage.setItem(
          'ponto_saas_sessao_encerrada',
          'Sua sessão terminou. Entre de novo para continuar.',
        );
      } catch { /* navegador sem sessionStorage: cai no login sem a explicacao */ }
      logout();
    };
    window.addEventListener('sessao-encerrada', aoEncerrar);
    return () => window.removeEventListener('sessao-encerrada', aoEncerrar);
  }, [logout]);

  /**
   * Confere a conta no servidor ao abrir o sistema.
   *
   * So sincroniza `papel`, `nome` e `email`. **Empresa e filial ficam de
   * fora de proposito:** para o super_admin, o `/me` devolve a empresa da
   * CONTA dele, e nao a que ele escolheu na tela — gravar isso trocaria a
   * unidade em operacao por outra, em silencio, e todas as telas passariam a
   * consultar a escola errada. Quem manda na empresa selecionada e o estado
   * daqui.
   *
   * Roda uma vez, na abertura. Nao vale sondar de tempos em tempos: cada
   * requisicao ja custa consulta ao banco na revalidacao do servidor, e um
   * 403 inesperado ja e o aviso natural de que algo mudou.
   */
  useEffect(() => {
    if (!obterToken()) return;
    let ativo = true;
    api.obterUsuarioAtual()
      .then(({ usuario: atual }) => {
        if (!ativo || !atual) return;
        setUsuario((anterior) => {
          if (!anterior) return anterior;
          const mudou = ['papel', 'nome', 'email']
            .some((campo) => atual[campo] !== undefined && atual[campo] !== anterior[campo]);
          if (!mudou) return anterior;
          const atualizado = {
            ...anterior,
            papel: atual.papel ?? anterior.papel,
            nome: atual.nome ?? anterior.nome,
            email: atual.email ?? anterior.email,
          };
          localStorage.setItem('ponto_saas_usuario', JSON.stringify(atualizado));
          return atualizado;
        });
      })
      .catch(() => {
        // Rede fora ou rota ausente: segue com o que o login guardou. O 401,
        // se for o caso, ja derruba pelo evento de sessao encerrada.
      });
    return () => { ativo = false; };
  }, []);

  /** `pode('alunos', 'deletar')` — a pergunta que as telas fazem. */
  const pode = useCallback(
    (recurso, acao) => podeNaMatriz(usuario, permissoes, recurso, acao),
    [usuario, permissoes],
  );

  return (
    <AuthContext.Provider
      value={{
        usuario, empresaSelecionada, filialSelecionada,
        permissoes, pode, carregarPermissoes,
        login, selecionarEmpresa, selecionarFilial, limparEmpresa, logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return contexto;
}
