import { createContext, useContext, useEffect, useState } from 'react';
import { api, salvarToken, limparToken, obterToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [responsavel, setResponsavel] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  // Ao abrir o app, so sabemos que ha uma sessao salva pelo token existir -
  // os dados do responsavel (nome, alunoIds) sao recarregados no proximo
  // login; para simplificar, aqui so verificamos se HA token e, se houver,
  // deixamos a tela inicial pedir login de novo caso as chamadas falhem com 401.
  useEffect(() => {
    obterToken().then((token) => {
      setCarregandoSessao(false);
      // Sem um endpoint "/me", nao recuperamos os dados do responsavel aqui -
      // isso fica para uma proxima iteracao (ver README). Por ora, token
      // presente so evita jogar direto pra tela de login antes de tentar.
      if (token) setResponsavel({ tokenPresente: true });
    });
  }, []);

  async function login(email, senha) {
    const { token, responsavel: dados } = await api.login(email, senha);
    await salvarToken(token);
    setResponsavel(dados);
    return dados;
  }

  async function logout() {
    await limparToken();
    setResponsavel(null);
  }

  return (
    <AuthContext.Provider value={{ responsavel, login, logout, carregandoSessao }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return contexto;
}
