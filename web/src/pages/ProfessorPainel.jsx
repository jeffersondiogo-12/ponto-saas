import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';

const hoje = new Date().toISOString().slice(0, 10);

export default function ProfessorPainel() {
  const [turmas, setTurmas] = useState([]);
  const [turma, setTurma] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [presencas, setPresencas] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [data, setData] = useState(hoje);
  const [materia, setMateria] = useState('');
  const [nota, setNota] = useState('');
  const [observacao, setObservacao] = useState('');
  const [alunoId, setAlunoId] = useState('');

  useEffect(() => {
    api.listarMinhasTurmas().then((res) => {
      setTurmas(res.turmas || []);
      if (res.turmas?.[0]) selecionarTurma(res.turmas[0]);
    }).catch((err) => setErro(err.message));
  }, []);

  async function selecionarTurma(item) {
    setTurma(item);
    setMateria(item.materia);
    try {
      const res = await api.listarAlunosDaTurma(item.turma_id);
      setAlunos(res.alunos || []);
      setAlunoId(res.alunos?.[0]?.id || '');
      setPresencas(Object.fromEntries((res.alunos || []).map((aluno) => [aluno.id, true])));
    } catch (err) { setErro(err.message); }
  }

  async function salvarPresencas(event) {
    event.preventDefault();
    setErro(''); setMensagem('');
    try {
      await api.registrarPresencasSala(turma.turma_id, { data, presencas: alunos.map((aluno) => ({ aluno_id: aluno.id, presente: presencas[aluno.id] })) });
      setMensagem('Presença da turma registrada.');
    } catch (err) { setErro(err.message); }
  }

  async function salvarNota(event) {
    event.preventDefault();
    try { await api.criarNotaProfessor(turma.turma_id, { aluno_id: alunoId, disciplina: materia, etapa: 'Atual', nota: Number(nota) }); setMensagem('Nota enviada ao painel do aluno.'); } catch (err) { setErro(err.message); }
  }

  async function salvarObservacao(event) {
    event.preventDefault();
    try { await api.criarObservacaoProfessor(turma.turma_id, { aluno_id: alunoId, titulo: `Observação de ${materia}`, texto: observacao }); setMensagem('Observação enviada ao responsável.'); } catch (err) { setErro(err.message); }
  }

  return <Layout>
    <h1 className="titulo-pagina">Área do professor</h1>
    {erro && <div className="erro">{erro}</div>}
    {mensagem && <div className="sucesso">{mensagem}</div>}
    <div className="card"><div className="card-corpo">
      <div className="campo">
        <label htmlFor="pp-turma">Turma e matéria</label>
        <Selecao
          id="pp-turma"
          rotuloAria="Turma e matéria"
          valor={turma?.turma_id || ''}
          aoMudar={(v) => selecionarTurma(turmas.find((item) => item.turma_id === v))}
          vazio="Selecione a turma"
          opcoes={turmas.map((item) => ({
            valor: item.turma_id,
            rotulo: `${item.nome} · ${item.materia} · ${item.hora_inicio}-${item.hora_fim}`,
          }))}
        />
      </div>
      {turma && <>
        <form onSubmit={salvarPresencas}>
          <div className="linha-form"><label>Data <input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label><button className="btn btn-primario">Salvar chamada</button></div>
          <table className="tabela"><thead><tr><th>Aluno</th><th>Presença em sala</th></tr></thead><tbody>{alunos.map((aluno) => <tr key={aluno.id}><td>{aluno.nome}</td><td><input type="checkbox" checked={Boolean(presencas[aluno.id])} onChange={(e) => setPresencas({ ...presencas, [aluno.id]: e.target.checked })} /> Presente</td></tr>)}</tbody></table>
        </form>
        <div className="linha-form">
          <div className="campo">
            <label htmlFor="pp-aluno">Aluno</label>
            <Selecao
              id="pp-aluno"
              rotuloAria="Aluno"
              valor={alunoId}
              aoMudar={setAlunoId}
              vazio="Selecione o aluno"
              opcoes={alunos.map((aluno) => ({ valor: aluno.id, rotulo: aluno.nome }))}
            />
          </div>
          <label>Nota <input type="number" min="0" max="10" step="0.01" value={nota} onChange={(e) => setNota(e.target.value)} /></label>
          <button className="btn btn-primario" onClick={salvarNota}>Lançar nota</button>
        </div>
        <div className="linha-form"><textarea placeholder="Observação para o responsável" value={observacao} onChange={(e) => setObservacao(e.target.value)} /><button className="btn btn-primario" onClick={salvarObservacao}>Enviar observação</button></div>
      </>}
    </div></div>
  </Layout>;
}
