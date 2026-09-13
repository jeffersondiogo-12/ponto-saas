import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  api, salvarToken, limparToken, obterToken, salvarSessao, obterSessao, limparSessao,
  limparCacheDoPerfil, limparFilaDoPerfil, salvarPerfilAtivo, obterPerfilAtivo,
  salvarPreferenciaManterLogin, obterPreferenciaManterLogin, ehFalhaDeRede,
  registrarEventosSessao, pausarFilaOffline, liberarFilaOffline, processarFilaOffline,
  sessaoAtualEh,
} from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // usuario.tipo === 'responsavel' -> pai/mae (login fixo por email+senha)
  // usuario.tipo === 'staff' com usuario.papel === 'professor' -> professor
  // (login por email+senha+unidade, igual ao gestor no web)
  const [usuario, setUsuario] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [sessaoOffline, setSessaoOffline] = useState(false);
  const encerramentoEmAndamento = useRef(null);

  const encerrarSessao = useCallback(async ({ preservarFila = false, contexto } = {}) => {
    if (contexto && !sessaoAtualEh(contexto.perfil, contexto.versao)) return;
    if (encerramentoEmAndamento.current) return encerramentoEmAndamento.current;

    pausarFilaOffline();
    setUsuario(null);
    setSessaoOffline(false);
    const tarefa = (async () => {
      const perfil = contexto?.perfil || await obterPerfilAtivo();
      try {
        await limparCacheDoPerfil(perfil);
        if (!preservarFila) await limparFilaDoPerfil(perfil);
      } finally {
        try {
          await limparToken(perfil);
        } finally {
          await limparSessao(perfil);
        }
      }
    })();
    encerramentoEmAndamento.current = tarefa;
    try {
      await tarefa;
    } finally {
      if (encerramentoEmAndamento.current === tarefa) encerramentoEmAndamento.current = null;
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    const pararEventos = registrarEventosSessao({
      naoAutenticado: (contexto) => encerrarSessao({ preservarFila: true, contexto }),
      online: () => {
        if (ativo) setSessaoOffline(false);
      },
    });

    (async () => {
      try {
        const [perfil, manterLogin] = await Promise.all([
          obterPerfilAtivo(), obterPreferenciaManterLogin(),
        ]);
        const [token, sessao] = await Promise.all([obterToken(perfil), obterSessao(perfil)]);
        if (!manterLogin || !token || !sessao) return;

        try {
          const resposta = await api.obterUsuarioAtual();
          const atual = resposta.usuario || sessao;
          await salvarSessao(atual, true, perfil);
          if (ativo) {
            setUsuario(atual);
            setSessaoOffline(false);
          }
        } catch (erro) {
          if (erro?.status === 401) {
            await encerrarSessao({ preservarFila: true });
          } else if (erro?.offline || ehFalhaDeRede(erro)) {
            if (ativo) {
              setUsuario(sessao);
              setSessaoOffline(true);
            }
          } else if (ativo) {
            setUsuario(null);
          }
        }
      } catch {
        // Falha de leitura do armazenamento nao pode deixar a abertura travada.
        if (ativo) setUsuario(null);
      } finally {
        if (ativo) setCarregandoSessao(false);
      }
    })();

    return () => {
      ativo = false;
      pararEventos();
    };
  }, [encerrarSessao]);

  async function loginResponsavel(email, senha, manterLogin = true) {
    const { token, responsavel } = await api.login(email, senha);
    if (encerramentoEmAndamento.current) await encerramentoEmAndamento.current.catch(() => {});
    await salvarPerfilAtivo('responsavel');
    await salvarPreferenciaManterLogin(manterLogin);
    await salvarToken(token, manterLogin, 'responsavel');
    await salvarSessao(responsavel, manterLogin, 'responsavel');
    liberarFilaOffline();
    setUsuario(responsavel);
    setSessaoOffline(false);
    processarFilaOffline().catch(() => {});
    return responsavel;
  }

  async function loginProfessor(email, senha, unidade, manterLogin = true) {
    const { token, usuario: dados } = await api.loginProfessor(email, senha, unidade);
    if (encerramentoEmAndamento.current) await encerramentoEmAndamento.current.catch(() => {});
    await salvarPerfilAtivo('professor');
    await salvarPreferenciaManterLogin(manterLogin);
    await salvarToken(token, manterLogin, 'professor');
    await salvarSessao(dados, manterLogin, 'professor');
    liberarFilaOffline();
    setUsuario(dados);
    setSessaoOffline(false);
    processarFilaOffline().catch(() => {});
    return dados;
  }

  async function logout() {
    await encerrarSessao();
  }

  return (
    <AuthContext.Provider value={{
      usuario, loginResponsavel, loginProfessor, logout, carregandoSessao, sessaoOffline,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return contexto;
}
