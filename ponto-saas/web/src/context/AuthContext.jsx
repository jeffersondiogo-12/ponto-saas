import { createContext, useContext, useState, useCallback } from 'react';
import {
  api,
  salvarToken,
  limparToken,
  obterEmpresaSelecionada,
  salvarEmpresaSelecionada,
  limparEmpresaSelecionada,
  obterFilialSelecionada,
  salvarFilialSelecionada,
  limparFilialSelecionada,
} from '../api';

const AuthContext = createContext(null);

function lerUsuarioSalvo() {
  const bruto = localStorage.getItem('ponto_saas_usuario');
  return bruto ? JSON.parse(bruto) : null;
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(lerUsuarioSalvo);
  const [empresaSelecionada, setEmpresaSelecionada] = useState(obterEmpresaSelecionada);
  const [filialSelecionada, setFilialSelecionada] = useState(obterFilialSelecionada);

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
    limparEmpresa();
    setUsuario(null);
  }, [limparEmpresa]);

  return (
    <AuthContext.Provider
      value={{ usuario, empresaSelecionada, filialSelecionada, login, selecionarEmpresa, selecionarFilial, limparEmpresa, logout }}
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
