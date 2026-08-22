import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../api';

export default function TurmasLista() {
  const [turmas, setTurmas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [professores, setProfessores] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [professorId, setProfessorId] = useState('');
  const [materia, setMateria] = useState('');
  const [inicio, setInicio] = useState('07:00');
  const [fim, setFim] = useState('08:00');

  useEffect(() => {
    api.listarTurmas?.().then((r) => {
      setTurmas((r && r.turmas) || []);
      setCarregando(false);
    }).catch(() => setCarregando(false));
  }, []);

  useEffect(() => {
    api.listarUsuarios().then((r) => setProfessores((r.usuarios || []).filter((u) => u.papel === 'professor' && u.ativo))).catch(() => {});
  }, []);

  async function atribuir(e) {
    e.preventDefault();
    await api.atribuirProfessor(selecionada.id, { professor_id: professorId, materia, hora_inicio: inicio, hora_fim: fim, dias_semana: [1, 2, 3, 4, 5] });
    setSelecionada(null);
  }

  return (
    <Layout>
      <h1 className="titulo-pagina">Turmas</h1>
      <div className="card">
        <div className="card-corpo">
          {carregando ? (
            <p className="texto-apoio">Carregando...</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>Ano</th><th>Horário do professor</th></tr>
              </thead>
              <tbody>
                {turmas.map((t) => (
                  <tr key={t.id}><td>{t.nome}</td><td>{t.ano_letivo}</td><td><button className="btn btn-secundario" onClick={() => setSelecionada(t)}>Atribuir professor</button></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {selecionada && <div className="card"><div className="card-corpo"><h2>Professor em {selecionada.nome}</h2><form onSubmit={atribuir}><div className="campo"><label>Professor</label><select value={professorId} onChange={(e) => setProfessorId(e.target.value)} required><option value="">Selecione</option>{professores.map((p) => <option key={p.id} value={p.id}>{p.nome} · {p.email}</option>)}</select></div><div className="campo"><label>Matéria</label><input value={materia} onChange={(e) => setMateria(e.target.value)} required /></div><div className="linha-form"><label>Início <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} required /></label><label>Fim <input type="time" value={fim} onChange={(e) => setFim(e.target.value)} required /></label></div><button className="btn btn-primario">Salvar horário e professor</button></form></div></div>}
    </Layout>
  );
}
