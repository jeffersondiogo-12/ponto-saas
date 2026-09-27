import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { Aviso, BotaoGrande, Cabecalho, Carregando, FaixaEstado, Opcoes, SeletorTurma } from '../Ui';
import { useVoltar } from '../useVoltar';

/** Observacoes: espelho da ObservacoesScreen do APK. Sem internet, vai para a fila. */
const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' });

export default function ObservacoesProfessor() {
  const voltar = useVoltar();
  const [turmas, setTurmas] = useState([]);
  const [turma, setTurma] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [alunoId, setAlunoId] = useState('');
  const [historico, setHistorico] = useState([]);
  const [observacao, setObservacao] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [offline, setOffline] = useState(false);
  const [cacheEm, setCacheEm] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregarHistorico = useCallback(async (turmaAlvo, alvoAlunoId) => {
    try {
      const res = await api.professor.historicoDoAluno(turmaAlvo.turma_id, alvoAlunoId, turmaAlvo.atribuicao_id);
      setHistorico(res.observacoes || []);
    } catch {
      setHistorico([]);
    }
  }, []);

  const selecionarTurma = useCallback(async (item) => {
    setTurma(item);
    setMensagem('');
    try {
      const res = await api.professor.listarAlunosDaTurma(item.turma_id, item.atribuicao_id);
      const lista = [...(res.alunos || [])].sort(porNome);
      setAlunos(lista);
      const primeiro = lista[0]?.id || '';
      setAlunoId(primeiro);
      if (primeiro) await carregarHistorico(item, primeiro);
      else setHistorico([]);
    } catch (err) {
      setErro(err?.message || 'Não foi possível completar a ação.');
    }
  }, [carregarHistorico]);

  useEffect(() => {
    window.scrollTo(0, 0);
    (async () => {
      try {
        const res = await api.professor.listarMinhasTurmas();
        const lista = res.turmas || [];
        setTurmas(lista);
        setOffline(Boolean(res._offline));
        setCacheEm(res._offline ? res._cacheEm || null : null);
        if (lista.length) await selecionarTurma(lista[0]);
      } catch (err) {
        setErro(err?.message || 'Não foi possível completar a ação.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [selecionarTurma]);

  async function salvar(evento) {
    evento.preventDefault();
    if (!turma || !alunoId || !observacao.trim()) {
      window.alert('Observação\n\nSelecione o aluno e escreva a observação.');
      return;
    }
    setEnviando(true);
    try {
      const resultado = await api.professor.criarObservacaoProfessor(turma.turma_id, {
        aluno_id: alunoId, atribuicao_id: turma.atribuicao_id, titulo: `Observação de ${turma.materia}`, texto: observacao.trim(),
      });
      setObservacao('');
      setErro('');
      if (resultado._fila) {
        setMensagem('Sem conexão: observação salva no aparelho e será enviada assim que a internet voltar.');
      } else {
        setMensagem('Observação enviada ao responsável.');
        await carregarHistorico(turma, alunoId);
      }
    } catch (err) {
      setErro(err?.message || 'Não foi possível completar a ação.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <main className="app-tela app-tela-pilha-form"><Carregando /></main>;

  return (
    <main className="app-tela app-tela-pilha-form">
      <Cabecalho
        rotulo="ACOMPANHAMENTO"
        titulo="Observações"
        subtitulo="Recados que chegam ao responsável do aluno."
        acao={<button type="button" className="app-voltar-pilula" onClick={voltar}>Voltar</button>}
      />
      <FaixaEstado offlineEm={cacheEm} offline={offline} />
      <Aviso tipo="erro" texto={erro} />
      <Aviso tipo="ok" texto={mensagem} />
      <SeletorTurma turmas={turmas} turmaAtiva={turma} aoSelecionar={selecionarTurma} />

      <p className="app-secao">Aluno</p>
      <Opcoes
        rotulo="Aluno"
        itens={alunos.map((aluno) => ({ chave: aluno.id, rotulo: aluno.nome }))}
        valor={alunoId}
        aoEscolher={async (id) => { setAlunoId(id); if (turma) await carregarHistorico(turma, id); }}
      />

      <form className="app-cartao app-aparecer" onSubmit={salvar} noValidate>
        <textarea className="app-area" placeholder="Escreva a observação..." aria-label="Observação"
          value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        <BotaoGrande tipo="submit" texto={enviando ? 'Enviando...' : 'Enviar observação'} desabilitado={enviando} />
      </form>

      <p className="app-secao">Últimas observações</p>
      {historico.length === 0 ? <p className="app-vazio-cartao">Nenhuma observação registrada ainda.</p> : historico.map((item, indice) => (
        <div key={item.id || indice} className="app-historico-cartao app-aparecer" style={{ '--app-atraso': `${indice * 50}ms`, '--app-deslocamento': '8px' }}>
          <p className="app-historico-titulo">{item.titulo || 'Observação'}</p>
          <p className="app-historico-texto">{item.texto}</p>
        </div>
      ))}
    </main>
  );
}
