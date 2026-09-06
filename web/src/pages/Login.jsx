import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Deixado pelo `logout` quando a sessao caiu sozinha. Quem chega aqui por
 * queda de sessao estava no meio de uma tarefa e merece saber o que houve —
 * sem isso, a tela de login aparece do nada e parece defeito.
 */
function motivoDaQueda() {
  try {
    const motivo = sessionStorage.getItem('ponto_saas_sessao_encerrada');
    if (motivo) sessionStorage.removeItem('ponto_saas_sessao_encerrada');
    return motivo;
  } catch {
    return null;
  }
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [unidade, setUnidade] = useState('');
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(motivoDaQueda);
  const [carregando, setCarregando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function aoEnviar(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setCarregando(true);
    try {
      await login(email, senha, unidade);
      navigate('/dashboard');
    } catch (err) {
      setErro(err.message || 'Não foi possível entrar.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="tela-login">
      <div className="caixa-login">
        <div className="marca">
          <img src="/ponte-escolar.png" alt="Ponte Escolar" className="marca-logo" />
        </div>
        {aviso && <div className="info">{aviso}</div>}
        {erro && <div className="erro">{erro}</div>}
        <form onSubmit={aoEnviar}>
          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="unidade">Ambiente (empresa)</label>
            <input
              id="unidade"
              type="text"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              placeholder="Nome ou CNPJ"
              required
            />
            <span className="ajuda">A empresa onde você trabalha. As escolas e filiais ficam dentro dela.</span>
          </div>
          <button className="btn btn-primario" type="submit" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
