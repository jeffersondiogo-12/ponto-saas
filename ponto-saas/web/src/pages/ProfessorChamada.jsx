import { useEffect, useState } from 'react';
import { api } from '../api';
import Layout from '../components/Layout';

export default function ProfessorChamada() {
  const [turmas, setTurmas] = useState([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState('');
  const [alunos, setAlunos] = useState([]);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarTurmas() {
      try {
        const token = localStorage.getItem('ponto_saas_professor_token');
        const resposta = await api.listarTurmasProfessor(token);
        const lista = [...(resposta.turmas || [])].sort((a, b) => a.nome.localeCompare(b.nome));
        setTurmas(lista);
        if (lista[0]) {
          setTurmaSelecionada(lista[0].id);
        }
      } finally {
        setCarregando(false);
      }
    }
    carregarTurmas();
  }, []);

  useEffect(() => {
    if (!turmaSelecionada) return;

    async function carregarLista() {
      const resposta = await api.listarChamadaProfessor({ turma_id: turmaSelecionada, data });
      const lista = [...(resposta.alunos || [])].sort((a, b) => a.nome.localeCompare(b.nome));
      setAlunos(lista);
    }

    carregarLista();
  }, [turmaSelecionada, data]);

  async function alterarStatus(alunoId, status) {
    setAlunos((atual) =>
      atual.map((aluno) =>
        aluno.id === alunoId ? { ...aluno, status } : aluno
      )
    );
  }

  async function salvar() {
    await api.salvarChamadaProfessor({ turma_id: turmaSelecionada, data, presencas: alunos.map((aluno) => ({ aluno_id: aluno.id, status: aluno.status || 'presente' })) });
    alert('Chamada salva com sucesso.');
  }

  return (
    <Layout>
      <h1 className="titulo-pagina">Chamada do professor</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-corpo" style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="campo" style={{ minWidth: 220 }}>
            <label>Turma</label>
            <select value={turmaSelecionada} onChange={(e) => setTurmaSelecionada(e.target.value)}>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>{turma.nome} · {turma.turno}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <button className="btn btn-primario" onClick={salvar}>Salvar chamada</button>
        </div>
      </div>

      <div className="card">
        <div className="card-corpo">
          {carregando ? (
            <p className="texto-apoio">Carregando...</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Matrícula</th>
                  <th>Período</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((aluno) => (
                  <tr key={aluno.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {aluno.foto_url ? (
                          <img src={aluno.foto_url} alt={aluno.nome} style={{ width: 38, height: 38, borderRadius: 999, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 38, height: 38, borderRadius: 999, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#374151' }}>
                            {aluno.nome?.split(' ')[0]?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <div>{aluno.nome}</div>
                          <small style={{ color: '#6b7280' }}>{aluno.cpf ? `CPF ${aluno.cpf}` : 'Sem CPF'}</small>
                        </div>
                      </div>
                    </td>
                    <td className="mono">{aluno.matricula}</td>
                    <td>{aluno.horario_entrada || '--'} / {aluno.horario_saida || '--'}</td>
                    <td>
                      <select value={aluno.status || 'pendente'} onChange={(e) => alterarStatus(aluno.id, e.target.value)}>
                        <option value="pendente">Pendente</option>
                        <option value="presente">Presente</option>
                        <option value="ausente">Ausente</option>
                        <option value="atrasado">Atrasado</option>
                        <option value="justificado">Justificado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
