import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function UsuarioForm() {
  const { filialSelecionada, empresaSelecionada, usuario } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState('staff');
  const [filialId, setFilialId] = useState('');
  const [filiais, setFiliais] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function carregarFiliais() {
      if (!empresaSelecionada) return;
      try {
        const res = await api.listarUnidades();
        if (!mounted) return;
        const items = res.filiais || res.unidades || [];
        const encontrados = items.filter((f) => String(f.empresa_id) === String(empresaSelecionada.id) && f.ativo && f.tipo === 'escola');
        setFiliais(encontrados);
        if (usuario?.papel !== 'admin' && filialSelecionada) {
          setFilialId(filialSelecionada.id);
        }
      } catch (e) {
        // ignore
      }
    }
    carregarFiliais();
    return () => { mounted = false; };
  }, [empresaSelecionada, filialSelecionada, usuario]);

  async function aoEnviar(e) {
    e.preventDefault();
    setErro(null);
    // admin pode escolher a filial
    if (usuario?.papel === 'admin' || usuario?.papel === 'super_admin') {
      if (!filialId) {
        setErro('Selecione a filial (escola) para vincular o usuário.');
        return;
      }
    } else {
      if (!filialSelecionada || filialSelecionada.tipo !== 'escola') {
        setErro('Selecione uma filial (escola) para criar usuários vinculados.');
        return;
      }
    }

    setCarregando(true);
    try {
      const payload = { nome, email, senha, papel };
      if (usuario?.papel === 'admin' || usuario?.papel === 'super_admin') payload.filial_id = filialId;
      await api.criarUsuario(payload);
      navigate('/usuarios');
    } catch (err) {
      setErro(err.message || 'Erro ao criar usuário');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Layout>
      <h1 className="titulo-pagina">Cadastrar Usuário</h1>
      <div className="card">
        <div className="card-corpo">
          {erro && <div className="erro">{erro}</div>}
          <form onSubmit={aoEnviar}>
            <div className="campo">
              <label>Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="campo">
              <label>E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="campo">
              <label>Senha</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            <div className="campo">
              <label>Papel</label>
              <select value={papel} onChange={(e) => setPapel(e.target.value)}>
                <option value="staff">Staff</option>
                <option value="rh">RH</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {(usuario?.papel === 'admin' || usuario?.papel === 'super_admin') && (
              <div className="campo">
                <label>Filial (escola)</label>
                <select value={filialId} onChange={(e) => setFilialId(e.target.value)} required>
                  <option value="">-- selecione --</option>
                  {filiais.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome || f.cnpj}</option>
                  ))}
                </select>
              </div>
            )}
            <button type="submit" className="btn btn-primario" disabled={carregando}>
              {carregando ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
