import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, salvarToken, limparToken, obterToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  // Ao abrir o app, so sabemos que ha uma sessao salva pelo token existir -
  // os dados do responsavel (nome, alunoIds) sao recarregados no proximo
  // login; para simplificar, aqui so verificamos se HA token e, se houver,
  // deixamos a tela inicial pedir login de novo caso as chamadas falhem com 401.
  useEffect(() => {
    Promise.all([obterToken(), AsyncStorage.getItem('@ponto_saas_tipo_sessao')]).then(([token, tipo]) => {
      setCarregandoSessao(false);
      // Sem um endpoint "/me", nao recuperamos os dados do responsavel aqui -
      // isso fica para uma proxima iteracao (ver README). Por ora, token
      // presente so evita jogar direto pra tela de login antes de tentar.
      if (token) setSessao({ tokenPresente: true, tipo: tipo || 'responsavel' });
    });
  }, []);

  async function login(email, senha, tipo, unidade) {
    const resposta = tipo === 'professor' ? await api.loginProfessor(email, senha, unidade) : await api.login(email, senha);
    const dados = tipo === 'professor' ? resposta.usuario : resposta.responsavel;
    const token = resposta.token;
    await salvarToken(token);
    await AsyncStorage.setItem('@ponto_saas_tipo_sessao', tipo);
    setSessao({ ...dados, tipo });
    return dados;
  }

  async function logout() {
    await limparToken();
    await AsyncStorage.removeItem('@ponto_saas_tipo_sessao');
    setSessao(null);
  }

  return (
    <AuthContext.Provider value={{ sessao, responsavel: sessao?.tipo === 'responsavel' ? sessao : null, login, logout, carregandoSessao }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return contexto;
}
