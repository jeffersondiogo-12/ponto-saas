import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ConfirmarExclusaoAluno from '../components/ConfirmarExclusaoAluno';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function AlunosLista() {
  const navigate = useNavigate();
  const { filialSelecionada, usuario } = useAuth();
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [aExcluir, setAExcluir] = useState(null);

  // O backend so aceita DELETE de super_admin, admin e rh (alunos.routes.js);
  // esconder o botao dos demais evita oferecer uma acao que daria 403.
  const podeExcluir = ['super_admin', 'admin', 'rh'].includes(usuario?.papel);

  const carregar = useCallback(async () => {
    try {
      const r = await api.listarAlunos();
      setAlunos(r.alunos || []);
      setErro(null);
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar os alunos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function aoExcluir(aluno) {
    setAExcluir(null);
    setAviso(`“${aluno.nome}” foi excluído permanentemente.`);
    await carregar();
  }

  return (
    <Layout>
      <h1 className="titulo-pagina">Alunos</h1>

      {erro && <div className="erro">{erro}</div>}
      {aviso && <div className="sucesso">{aviso}</div>}

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
                <tr><th>Nome</th><th>Matrícula</th><th>Turma</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {alunos.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nome}</td>
                    <td className="mono">{a.matricula || '—'}</td>
                    <td>{a.turma_nome || ''}</td>
                    <td>
                      <div className="acoes-form" style={{ margin: 0, justifyContent: 'flex-start' }}>
                        <button
                          type="button"
                          className="btn btn-secundario btn-pequeno"
                          onClick={() => navigate(`/alunos/${a.id}/editar`)}
                        >
                          Editar
                        </button>
                        {podeExcluir && (
                          <button
                            type="button"
                            className="btn btn-perigo btn-pequeno"
                            onClick={() => { setAviso(null); setAExcluir(a); }}
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {alunos.length === 0 && (
                  <tr><td colSpan={4}><div className="vazio">Nenhum aluno cadastrado ainda.</div></td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {aExcluir && (
        <ConfirmarExclusaoAluno
          aluno={aExcluir}
          aoFechar={() => setAExcluir(null)}
          aoExcluir={aoExcluir}
        />
      )}
    </Layout>
  );
}
