import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useRecarregarAoVivo } from '../../context/RealtimeContext';
import { Aviso, BotaoGrande, Cabecalho, Carregando, Cartao, FaixaEstado, SeletorTurma } from '../Ui';
import { dataHoje } from '../datas';

/**
 * Chamada: espelho da ChamadaScreen do APK. Toque alterna presente, ausente e
 * falta justificada; so salva com todos marcados. Sem internet, a chamada vai
 * para a fila e a lista de alunos vem do cache do professor.
 *
 * Esta tela fica montada ao trocar de aba (ver AbasProfessor): a chamada pela
 * metade nao se perde, como no APK.
 */
const ORDEM_ESTADOS = ['presente', 'ausente', 'justificada'];
const ESTADOS = {
  nao_marcado: 'Toque para marcar',
  presente: 'Presente',
  ausente: 'Ausente',
  justificada: 'Falta justificada',
};

const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' });

export default function ChamadaProfessor() {
  const navigate = useNavigate();
  const [turmas, setTurmas] = useState([]);
  const [turma, setTurma] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [estados, setEstados] = useState({});
  const [justificativas, setJustificativas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [carregandoTurma, setCarregandoTurma] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [offline, setOffline] = useState(false);
  const [cacheEm, setCacheEm] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const selecionarTurma = useCallback(async (item) => {
    setTurma(item);
    setCarregandoTurma(true);
    setMensagem('');
    try {
      const res = await api.professor.listarAlunosDaTurma(item.turma_id, item.atribuicao_id);
      setAlunos([...(res.alunos || [])].sort(porNome));
      setEstados({});
      setJustificativas({});
    } catch (err) {
      setErro(err?.message || 'Não foi possível completar a ação.');
    } finally {
      setCarregandoTurma(false);
    }
  }, []);

  const carregarTurmas = useCallback(async (manterId) => {
    try {
      const res = await api.professor.listarMinhasTurmas();
      const lista = res.turmas || [];
      setTurmas(lista);
      setOffline(Boolean(res._offline));
      setCacheEm(res._offline ? res._cacheEm || null : null);
      setErro('');
      if (!lista.length) {
        setTurma(null);
        setAlunos([]);
        return;
      }
      await selecionarTurma((manterId && lista.find((item) => item.atribuicao_id === manterId)) || lista[0]);
    } catch (err) {
      setErro(err?.message || 'Não foi possível completar a ação.');
    }
  }, [selecionarTurma]);

  useEffect(() => {
    carregarTurmas().finally(() => setCarregando(false));
  }, [carregarTurmas]);

  // O gestor pode atribuir ou tirar uma turma com a chamada aberta.
  useRecarregarAoVivo(['turma.atribuida'], () => carregarTurmas(turma?.atribuicao_id));

  function alternar(aluno) {
    const atual = estados[aluno.id];
    const proximo = atual ? ORDEM_ESTADOS[(ORDEM_ESTADOS.indexOf(atual) + 1) % ORDEM_ESTADOS.length] : ORDEM_ESTADOS[0];
    setEstados({ ...estados, [aluno.id]: proximo });
  }

  async function salvar() {
    if (!turma) return;
    setEnviando(true);
    try {
      const resultado = await api.professor.registrarPresencasSala(turma.turma_id, {
        data: dataHoje(),
        atribuicao_id: turma.atribuicao_id,
        presencas: alunos.map((aluno) => ({
          aluno_id: aluno.id,
          presente: estados[aluno.id] === 'presente',
          falta_justificada: estados[aluno.id] === 'justificada',
          justificativa: justificativas[aluno.id] || '',
        })),
      });
      setErro('');
      setMensagem(resultado._fila
        ? 'Sem conexão: chamada salva no aparelho e será enviada assim que a internet voltar.'
        : 'Chamada registrada para a turma.');
    } catch (err) {
      setErro(err?.message || 'Não foi possível completar a ação.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <main className="app-tela"><Carregando /></main>;

  const hoje = dataHoje();
  const totalPresentes = alunos.filter((aluno) => estados[aluno.id] === 'presente').length;
  const todosMarcados = alunos.length > 0 && alunos.every((aluno) => Boolean(estados[aluno.id]));
  const turmaPronta = turmas.length > 0 && !carregandoTurma;

  return (
    <main className="app-tela">
      <Cabecalho
        rotulo="PRESENÇA EM SALA"
        titulo="Chamada"
        subtitulo={`Toque para alternar entre presente, ausente e falta justificada · ${hoje.split('-').reverse().join('/')}`}
      />
      <FaixaEstado offlineEm={cacheEm} offline={offline} />
      <Aviso tipo="erro" texto={erro} />
      <Aviso tipo="ok" texto={mensagem} />

      <SeletorTurma turmas={turmas} turmaAtiva={turma} aoSelecionar={selecionarTurma} />

      {turmas.length === 0 ? (
        <Cartao><p className="app-vazio-cartao">Nenhuma turma atribuída pelo gestor ainda.</p></Cartao>
      ) : carregandoTurma ? (
        <Carregando />
      ) : (
        <>
          <Cartao>
            <p className="app-resumo-texto">{totalPresentes} de {alunos.length} presentes</p>
            <div className="app-barra-fundo">
              <div className="app-barra-progresso" style={{ width: `${alunos.length ? (totalPresentes / alunos.length) * 100 : 0}%` }} />
            </div>
          </Cartao>
          {alunos.length === 0
            ? <p className="app-vazio-cartao">Nenhum aluno ativo nesta turma.</p>
            : <BotaoGrande texto="Marcar todos presentes" secundario onClick={() => setEstados(Object.fromEntries(alunos.map((a) => [a.id, 'presente'])))} />}
        </>
      )}

      {turmaPronta ? alunos.map((aluno, indice) => {
        const estado = estados[aluno.id] || 'nao_marcado';
        return (
          <div key={aluno.id} className="app-aluno-cartao app-aparecer" style={{ '--app-atraso': `${indice * 45}ms`, '--app-deslocamento': '8px' }}>
            <button type="button" className="app-aluno-linha app-pressao" onClick={() => alternar(aluno)}>
              <span className="app-aluno-textos">
                <span className="app-aluno-nome">{aluno.nome}</span>
                <span className="app-aluno-detalhe">{aluno.presenca_facial ? 'Chegou ao colégio' : 'Sem registro de entrada'}</span>
              </span>
              <span className={`app-chave app-chave-${estado}`}>{ESTADOS[estado]}</span>
            </button>
            {estado === 'justificada' ? (
              <input
                className="app-justificativa"
                placeholder="Motivo da falta justificada"
                aria-label={`Motivo da falta justificada de ${aluno.nome}`}
                value={justificativas[aluno.id] || ''}
                onChange={(e) => setJustificativas({ ...justificativas, [aluno.id]: e.target.value })}
              />
            ) : null}
            <button
              type="button"
              className="app-ver-mais"
              onClick={() => navigate(`/aluno/${turma.turma_id}/${aluno.id}?atribuicao=${encodeURIComponent(turma.atribuicao_id)}`, { state: { nome: aluno.nome } })}
            >
              Ver ficha do aluno
            </button>
          </div>
        );
      }) : null}

      {turmaPronta && alunos.length > 0 ? (
        <>
          {!todosMarcados ? <p className="app-pendente-texto">Marque todos os alunos para salvar a chamada.</p> : null}
          <BotaoGrande texto={enviando ? 'Enviando...' : 'Salvar chamada'} onClick={salvar} desabilitado={enviando || !todosMarcados} />
        </>
      ) : null}
    </main>
  );
}
