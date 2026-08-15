import { createContext, useContext, useEffect, useState } from 'react';
import { api, salvarToken, limparToken, obterToken, salvarTipoSessao, obterTipoSessao } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [responsavel, setResponsavel] = useState(null);
  const [professor, setProfessor] = useState(null);
  const [tipoSessao, setTipoSessao] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  useEffect(() => {
    async function carregarSessaoSalva() {
      const tipo = (await obterTipoSessao()) || 'responsavel';
      const token = await obterToken(tipo);
      setTipoSessao(tipo);
      if (token) {
        if (tipo === 'professor') {
          setProfessor({ tokenPresente: true, tipo: 'professor' });
          setResponsavel(null);
        } else {
          setResponsavel({ tokenPresente: true, tipo: 'responsavel' });
          setProfessor(null);
        }
      } else {
        setResponsavel(null);
        setProfessor(null);
      }
      setCarregandoSessao(false);
    }

    carregarSessaoSalva();
  }, []);

  async function login(email, senha, tipo = 'responsavel') {
    const dados = tipo === 'professor' ? await api.loginProfessor(email, senha) : await api.login(email, senha);
    const usuario = tipo === 'professor' ? dados.professor : dados.responsavel;
    await salvarTipoSessao(tipo);
    await salvarToken(dados.token, tipo);

    if (tipo === 'professor') {
      setProfessor(usuario);
      setResponsavel(null);
    } else {
      setResponsavel(usuario);
      setProfessor(null);
    }
    setTipoSessao(tipo);
    return usuario;
  }

  async function logout() {
    const tipoAtual = tipoSessao || 'responsavel';
    await limparToken(tipoAtual);
    await salvarTipoSessao(null);
    setResponsavel(null);
    setProfessor(null);
    setTipoSessao(null);
  }

  return (
    <AuthContext.Provider value={{ responsavel, professor, tipoSessao, login, logout, carregandoSessao }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return contexto;
}
