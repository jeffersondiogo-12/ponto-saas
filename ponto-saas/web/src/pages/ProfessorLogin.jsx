import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function ProfessorLogin() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  async function aoEnviar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const resposta = await api.loginProfessor(email, senha);
      localStorage.setItem('ponto_saas_professor_token', resposta.token);
      navigate('/professor');
    } catch (err) {
      setErro(err.message || 'Erro no login do professor.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="tela-login">
      <div className="caixa-login">
        <div className="marca">Ponto<span className="ponto-brass">·</span>SaaS</div>
        <h2 style={{ marginBottom: 16 }}>Professor</h2>
        {erro && <div className="erro">{erro}</div>}
        <form onSubmit={aoEnviar}>
          <div className="campo">
            <label>E-mail do professor</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="campo">
            <label>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </div>
          <button className="btn btn-primario" type="submit" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
