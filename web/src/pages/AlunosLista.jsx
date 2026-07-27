import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function AlunosLista() {
  const navigate = useNavigate();
  const { filialSelecionada } = useAuth();
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.listarAlunos().then((r) => {
      setAlunos(r.alunos || []);
      setCarregando(false);
    });
  }, []);

  return (
    <Layout>
      <h1 className="titulo-pagina">Alunos</h1>
      {filialSelecionada && filialSelecionada.tipo === 'escola' && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-primario" onClick={() => navigate('/alunos/novo')}>Cadastrar aluno</button>
        </div>
      )}
      <div className="card">
        <div className="card-corpo">
          {carregando ? (
            <p className="texto-apoio">Carregando...</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>Matrícula</th><th>Turma</th></tr>
              </thead>
              <tbody>
                {alunos.map((a) => (
                  <tr key={a.id}><td>{a.nome}</td><td className="mono">{a.matricula}</td><td>{a.turma_nome || ''}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
