import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { Aviso, BotaoGrande, Cabecalho, Carregando, FaixaEstado, Opcoes, SeletorTurma } from '../Ui';
import { useVoltar } from '../useVoltar';

/** Notas: espelho da NotasScreen do APK. Sem internet, a nota vai para a fila. */
const BIMESTRES = ['1', '2', '3', '4'];
// Mesma lista e grafia do web (ProfessorPainel.jsx) e do APK: o campo e texto cru.
const TIPOS_AVALIACAO = ['Prova', 'Trabalho', 'Atividade', 'Participação', 'Seminário', 'Recuperação'];

const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' });

export default function NotasProfessor() {
  const voltar = useVoltar();
  const [turmas, setTurmas] = useState([]);
  const [turma, setTurma] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [alunoId, setAlunoId] = useState('');
  const [historico, setHistorico] = useState([]);
  const [bimestre, setBimestre] = useState('1');
  const [tipoAvaliacao, setTipoAvaliacao] = useState('Prova');
  const [atividade, setAtividade] = useState('');
  const [nota, setNota] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [offline, setOffline] = useState(false);
  const [cacheEm, setCacheEm] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregarHistorico = useCallback(async (turmaAlvo, alvoAlunoId) => {
    try {
      const res = await api.professor.historicoDoAluno(turmaAlvo.turma_id, alvoAlunoId, turmaAlvo.atribuicao_id);
      setHistorico(res.notas || []);
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
    if (!turma || !alunoId) { window.alert('Nota\n\nSelecione a turma e o aluno.'); return; }
    const valor = Number(String(nota).replace(',', '.'));
    if (!nota || Number.isNaN(valor) || valor < 0 || valor > 10 || !atividade.trim()) {
      window.alert('Nota\n\nInforme bimestre, atividade e uma nota válida entre 0 e 10.');
      return;
    }
    setEnviando(true);
    try {
      const resultado = await api.professor.criarNotaProfessor(turma.turma_id, {
        aluno_id: alunoId, atribuicao_id: turma.atribuicao_id, disciplina: turma.materia,
        bimestre: Number(bimestre), tipo_avaliacao: tipoAvaliacao, atividade: atividade.trim(), nota: valor,
      });
      setNota('');
      setAtividade('');
      setErro('');
      if (resultado._fila) {
        setMensagem('Sem conexão: nota salva no aparelho e será enviada assim que a internet voltar.');
      } else {
        setMensagem('Nota enviada ao painel do aluno.');
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
        rotulo="AVALIAÇÕES"
        titulo="Notas"
        subtitulo="Lance uma nota por aluno e acompanhe o histórico."
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
        <p className="app-secao">Bimestre</p>
        <Opcoes rotulo="Bimestre" itens={BIMESTRES} valor={bimestre} aoEscolher={setBimestre} />
        <p className="app-secao">Tipo</p>
        <Opcoes rotulo="Tipo de avaliação" itens={TIPOS_AVALIACAO} valor={tipoAvaliacao} aoEscolher={setTipoAvaliacao} />
        <input className="app-input-simples" placeholder="Atividade (ex.: Prova de frações)" aria-label="Atividade"
          value={atividade} onChange={(e) => setAtividade(e.target.value)} />
        <input className="app-input-simples" placeholder="Nota de 0 a 10" aria-label="Nota de 0 a 10" inputMode="decimal"
          value={nota} onChange={(e) => setNota(e.target.value)} />
        <BotaoGrande tipo="submit" texto={enviando ? 'Enviando...' : 'Salvar nota'} desabilitado={enviando} />
      </form>

      <p className="app-secao">Histórico do aluno</p>
      {historico.length === 0 ? <p className="app-vazio-cartao">Nenhuma nota lançada ainda.</p> : historico.map((item, indice) => (
        <div key={item.id || indice} className="app-historico app-aparecer" style={{ '--app-atraso': `${indice * 50}ms`, '--app-deslocamento': '8px' }}>
          <span className="app-historico-textos">
            <span className="app-historico-titulo">{item.atividade || item.disciplina}</span>
            <span className="app-historico-detalhe">
              {item.bimestre ? `${item.bimestre}º bimestre` : ''} {item.tipo_avaliacao ? `· ${item.tipo_avaliacao}` : ''}
            </span>
          </span>
          <span className="app-historico-nota">{item.nota}</span>
        </div>
      ))}
    </main>
  );
}
