import { createContext, useContext, useEffect, useState } from 'react';
import { api, salvarToken, limparToken, obterToken, salvarSessao, obterSessao, limparSessao, salvarPerfilAtivo, obterPerfilAtivo, salvarPreferenciaManterLogin, obterPreferenciaManterLogin } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // usuario.tipo === 'responsavel' -> pai/mae (login fixo por email+senha)
  // usuario.tipo === 'staff' com usuario.papel === 'professor' -> professor
  // (login por email+senha+unidade, igual ao gestor no web)
  const [usuario, setUsuario] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  // Nao existe endpoint "/me" no backend, entao ao reabrir o app o unico
  // jeito de saber QUEM esta logado e com qual papel e reler o que o login
  // guardou da ultima vez (ver salvarSessao em api.js). Se o token tiver
  // expirado, as chamadas seguintes falham com 401 e a tela cai pro login.
  useEffect(() => {
    Promise.all([obterPerfilAtivo(), obterPreferenciaManterLogin()]).then(async ([perfil, manterLogin]) => {
      const [token, sessao] = await Promise.all([obterToken(perfil), obterSessao(perfil)]);
      if (manterLogin && token && sessao) setUsuario(sessao);
      setCarregandoSessao(false);
    });
  }, []);

  async function loginResponsavel(email, senha, manterLogin = true) {
    const { token, responsavel } = await api.login(email, senha);
    await salvarPerfilAtivo('responsavel');
    await salvarPreferenciaManterLogin(manterLogin);
    await salvarToken(token, manterLogin, 'responsavel');
    await salvarSessao(responsavel, manterLogin, 'responsavel');
    setUsuario(responsavel);
    return responsavel;
  }

  async function loginProfessor(email, senha, unidade, manterLogin = true) {
    const { token, usuario: dados } = await api.loginProfessor(email, senha, unidade);
    await salvarPerfilAtivo('professor');
    await salvarPreferenciaManterLogin(manterLogin);
    await salvarToken(token, manterLogin, 'professor');
    await salvarSessao(dados, manterLogin, 'professor');
    setUsuario(dados);
    return dados;
  }

  async function logout() {
    await limparToken();
    await limparSessao();
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, loginResponsavel, loginProfessor, logout, carregandoSessao }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return contexto;
}
