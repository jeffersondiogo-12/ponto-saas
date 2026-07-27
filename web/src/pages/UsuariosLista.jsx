import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function UsuariosLista() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const { filialSelecionada } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.listarUsuarios().then((r) => {
      setUsuarios(r.usuarios || []);
      setCarregando(false);
    }).catch(() => setCarregando(false));
  }, []);

  return (
    <Layout>
      <h1 className="titulo-pagina">Usuários</h1>
      <div className="card">
        <div className="card-corpo">
          {filialSelecionada && filialSelecionada.tipo === 'escola' && (
            <div style={{ marginBottom: 12 }}>
              <button className="btn btn-primario" onClick={() => navigate('/usuarios/novo')}>Cadastrar usuário</button>
            </div>
          )}

          {carregando ? (
            <p className="texto-apoio">Carregando...</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>E-mail</th><th>Papel</th></tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}><td>{u.nome}</td><td className="mono">{u.email}</td><td>{u.papel}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
