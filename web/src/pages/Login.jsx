import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [unidade, setUnidade] = useState('');
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function aoEnviar(e) {
    e.preventDefault();
    setErro(null);
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
          Ponto<span className="ponto-brass">·</span>SaaS
        </div>
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
              placeholder="Digite o nome ou CNPJ da empresa (ambiente)"
              required
            />
            <p className="texto-apoio" style={{ marginTop: 8 }}>
              Faça login no ambiente (empresa). Dentro deste ambiente você poderá criar unidades (escola ou filial) que liberarão as telas correspondentes.
            </p>
          </div>
          <button className="btn btn-primario" type="submit" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
