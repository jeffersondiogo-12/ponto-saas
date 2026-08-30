import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useRecarregarAoVivo } from '../context/RealtimeContext';
import { baixarCsv, exportarPdf } from '../utils/exportar';
import { rotuloTipoBatida, rotuloTurno } from '../utils/dominio';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const hoje = () => new Date().toISOString().slice(0, 10);
const hhmm = (v) => String(v || '').slice(0, 5);

function comoDias(v) {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v || '[]'); } catch { return []; }
}

/**
 * `registros_ponto.data_hora` e `timestamp with time zone`. Mandar a data
 * crua ("2026-08-29") como `ate` cortaria o dia na meia-noite e devolveria
 * quase nada, entao os limites vao em ISO completo. `new Date('...T00:00:00')`
 * sem sufixo e lido como hora LOCAL, e o toISOString converte para UTC - o
 * dia enviado e o dia de quem esta olhando a tela.
 */
function limitesDoDia(data) {
  return {
    de: new Date(`${data}T00:00:00`).toISOString(),
    ate: new Date(`${data}T23:59:59.999`).toISOString(),
  };
}

const horaDaBatida = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Painel do gestor.
 *
 * O papel `gestor` acompanha a operacao da unidade sem alterar cadastro. O que
 * o backend libera para ele (ver professores.routes.js) e exatamente isto:
 * ver a grade da turma, ver e atribuir professores, e registrar presenca —
 * inclusive fora da janela da aula, que e a excecao concedida ao gestor.
 *
 * Alunos vem de /api/alunos?turma_id=, e nao da rota do professor, que e
 * restrita a papel `professor`. Por isso aqui nao ha o campo `presenca_facial`.
 */
export default function GestorPainel() {
  const { usuario } = useAuth();
  const podeVer = ['gestor', 'admin', 'super_admin'].includes(usuario?.papel);

  const [turmas, setTurmas] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [alunos, setAlunos] = useState([]);
  const [grade, setGrade] = useState(null);
  const [professores, setProfessores] = useState([]);

  const [data, setData] = useState(hoje());
  const [presencas, setPresencas] = useState({});

  const [batidas, setBatidas] = useState([]);
  const [batidasIndisponivel, setBatidasIndisponivel] = useState(false);
  const [carregandoBatidas, setCarregandoBatidas] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [carregandoTurma, setCarregandoTurma] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  const turma = useMemo(() => turmas.find((t) => t.id === turmaId) || null, [turmas, turmaId]);

  useEffect(() => {
    if (!podeVer) { setCarregando(false); return; }
    api.listarTurmas()
      .then((r) => {
        const ativas = (r.turmas || []).filter((t) => t.ativo);
        setTurmas(ativas);
        if (ativas[0]) setTurmaId(ativas[0].id);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [podeVer]);

  const carregarTurma = useCallback(async () => {
    if (!turmaId) return;
    setCarregandoTurma(true);
    setErro(null);
    const [al, gr, pr] = await Promise.allSettled([
      api.listarAlunos({ turma_id: turmaId }),
      api.gradeDaTurma(turmaId),
      api.listarProfessoresTurma(turmaId),
    ]);

    if (al.status === 'fulfilled') {
      const lista = (al.value.alunos || []).filter((a) => a.ativo);
      setAlunos(lista);
      setPresencas(Object.fromEntries(lista.map((a) => [a.id, true])));
    } else {
      setAlunos([]);
    }
    setGrade(gr.status === 'fulfilled' ? gr.value : null);
    setProfessores(pr.status === 'fulfilled' ? (pr.value.professores || []) : []);
    setCarregandoTurma(false);
  }, [turmaId]);

  useEffect(() => { carregarTurma(); }, [carregarTurma]);

  /**
   * Batidas da turma no dia escolhido. `turma_id` vai na consulta de proposito,
   * e nao como filtro no cliente: o teto de 500 do endpoint e aplicado no banco,
   * antes de qualquer filtro daqui - sem o recorte, outra unidade da mesma
   * empresa poderia ocupar as 500 linhas e esta turma apareceria vazia.
   *
   * `silencioso` serve a recarga por evento: a lista troca no lugar, sem passar
   * por "carregando" na frente de quem esta lendo.
   */
  const carregarBatidas = useCallback(async (silencioso = false) => {
    if (!turmaId) { setBatidas([]); return; }
    if (!silencioso) setCarregandoBatidas(true);
    try {
      const { de, ate } = limitesDoDia(data);
      const r = await api.listarRegistrosAlunos({ turma_id: turmaId, de, ate, limite: 200 });
      setBatidas(r.registros || []);
      setBatidasIndisponivel(false);
    } catch {
      // Degrada por secao, como o Dashboard: o resto do painel continua de pe.
      setBatidas([]);
      setBatidasIndisponivel(true);
    } finally {
      if (!silencioso) setCarregandoBatidas(false);
    }
  }, [turmaId, data]);

  useEffect(() => { carregarBatidas(); }, [carregarBatidas]);

  const recarregarBatidas = useCallback(() => carregarBatidas(true), [carregarBatidas]);
  useRecarregarAoVivo(['ponto.criado'], recarregarBatidas);

  const aulas = grade?.aulas || [];
  const [atribuicaoId, setAtribuicaoId] = useState('');

  useEffect(() => { setAtribuicaoId(aulas[0]?.atribuicao_id ? String(aulas[0].atribuicao_id) : ''); }, [grade]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPresentes = useMemo(
    () => alunos.filter((a) => presencas[a.id]).length,
    [alunos, presencas],
  );

  async function salvarChamada(e) {
    e.preventDefault();
    setErro(null); setMensagem(null);
    if (!atribuicaoId) { setErro('Selecione a aula à qual esta chamada pertence.'); return; }

    setOcupado(true);
    try {
      await api.registrarPresencasSala(turmaId, {
        data,
        atribuicao_id: atribuicaoId,
        presencas: alunos.map((a) => ({ aluno_id: a.id, presente: Boolean(presencas[a.id]) })),
      });
      setMensagem(`Chamada registrada — ${totalPresentes} de ${alunos.length} presentes.`);
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  }

  function exportarTurma() {
    if (!turma) return;
    baixarCsv(`turma-${turma.nome}-${hoje()}.csv`.replace(/\s+/g, '-'), [
      ['Turma', turma.nome],
      ['Unidade', turma.filial_nome],
      ['Turno', rotuloTurno(turma.turno)],
      ['Ano letivo', turma.ano_letivo],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      [],
      ['Grade'],
      ['Matéria', 'Professor', 'Dias', 'Início', 'Fim'],
      ...aulas.map((a) => [
        a.materia, a.professor_nome,
        comoDias(a.dias_semana).map((d) => DIAS[d]).join(', '),
        hhmm(a.hora_inicio), hhmm(a.hora_fim),
      ]),
      [],
      ['Alunos'],
      ['Nome', 'Matrícula', 'Nascimento'],
      ...alunos.map((a) => [
        a.nome, a.matricula || '',
        a.data_nascimento ? new Date(a.data_nascimento).toLocaleDateString('pt-BR') : '',
      ]),
    ]);
  }

  if (carregando) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;

  if (!podeVer) {
    return (
      <Layout>
        <h1 className="titulo-pagina">Gestão</h1>
        <div className="aviso">
          Esta tela é do perfil <strong>gestor</strong>. Se você precisa acompanhar
          turmas, peça esse acesso a quem administra o sistema.
        </div>
        <Link to="/dashboard" className="btn btn-secundario">Voltar à visão geral</Link>
      </Layout>
    );
  }

  if (!turmas.length) {
    return (
      <Layout>
        <h1 className="titulo-pagina">Gestão</h1>
        {erro && <div className="erro">{erro}</div>}
        <div className="aviso">
          Nenhuma turma ativa nesta unidade. Cadastre uma em <Link to="/turmas">Turmas</Link>.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="barra-acoes">
        <div>
          <h1 className="titulo-pagina" style={{ margin: 0 }}>Gestão</h1>
          <p className="subtitulo-pagina" style={{ margin: '3px 0 0' }}>
            Acompanhe a operação das turmas — grade, professores e chamada.
          </p>
        </div>
        <div className="grupo" style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secundario" onClick={exportarTurma} disabled={!turma}>
            Exportar .csv
          </button>
          <button type="button" className="btn btn-secundario" onClick={exportarPdf} disabled={!turma}>
            Exportar .pdf
          </button>
        </div>
      </div>

      {erro && <div className="erro">{erro}</div>}
      {mensagem && <div className="sucesso">{mensagem}</div>}

      <div className="filtros">
        <div className="campo" style={{ minWidth: 280 }}>
          <label htmlFor="ge-turma">Turma</label>
          <Selecao
            id="ge-turma"
            rotuloAria="Turma"
            valor={turmaId}
            aoMudar={setTurmaId}
            opcoes={turmas.map((t) => ({
              valor: t.id,
              rotulo: `${t.nome} · ${rotuloTurno(t.turno)} · ${t.ano_letivo}`,
            }))}
          />
        </div>
        <div className="espaco" />
        <Link to={`/turmas/${turmaId}`} className="btn btn-secundario">Abrir cadastro da turma</Link>
      </div>

      <section className="secao">
        <div className="numeros">
          <div className="numero"><div className="valor">{alunos.length}</div><div className="label">Alunos ativos</div></div>
          <div className="numero"><div className="valor">{aulas.length}</div><div className="label">Aulas na grade</div></div>
          <div className="numero"><div className="valor">{professores.length}</div><div className="label">Professores</div></div>
          <div className={`numero ${grade?.janela_turma ? 'ok' : 'destaque'}`}>
            <div className="valor">
              {grade?.janela_turma
                ? `${hhmm(grade.janela_turma.hora_entrada)}–${hhmm(grade.janela_turma.hora_saida)}`
                : '—'}
            </div>
            <div className="label">{grade?.janela_turma ? 'Janela da turma' : 'Sem horário definido'}</div>
          </div>
        </div>
      </section>

      {!grade?.janela_turma && (
        <div className="aviso">
          Esta turma não tem janela de entrada e saída definida. É ela que delimita a
          chamada e a presença do facial — defina em{' '}
          <Link to={`/turmas/${turmaId}`}>gestão da turma</Link>.
        </div>
      )}

      <div className="colunas">
        <section className="secao">
          <h2>
            Grade
            {aulas.length > 0 && <span className="nota">{aulas.length} aula(s)</span>}
          </h2>
          <div className="painel">
            <table className="tabela">
              <thead>
                <tr><th>Matéria</th><th>Professor</th><th>Dias</th><th>Horário</th></tr>
              </thead>
              <tbody>
                {aulas.map((a) => (
                  <tr key={a.atribuicao_id}>
                    <td>{a.materia}</td>
                    <td>{a.professor_nome}</td>
                    <td className="mono">{comoDias(a.dias_semana).map((d) => DIAS[d]).join(', ') || '—'}</td>
                    <td className="mono">{hhmm(a.hora_inicio)} – {hhmm(a.hora_fim)}</td>
                  </tr>
                ))}
                {!aulas.length && (
                  <tr>
                    <td colSpan={4}>
                      <div className="vazio">
                        Nenhuma aula atribuída. Atribua professores em{' '}
                        <Link to={`/turmas/${turmaId}`}>gestão da turma</Link>.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="secao">
          <h2>
            Alunos
            <span className="nota">{alunos.length === 1 ? '1 ativo' : `${alunos.length} ativos`}</span>
          </h2>
          <div className="painel">
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>Matrícula</th><th>Nascimento</th></tr>
              </thead>
              <tbody>
                {alunos.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nome}</td>
                    <td>
                      {a.matricula
                        ? <span className="chip-dado">{a.matricula}</span>
                        : <span className="badge">sem matrícula</span>}
                    </td>
                    <td className="mono">
                      {a.data_nascimento ? new Date(a.data_nascimento).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
                {!alunos.length && (
                  <tr><td colSpan={3}><div className="vazio">Nenhum aluno ativo nesta turma.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="secao">
        <h2>
          Chamada da turma
          <span className="nota">{totalPresentes} de {alunos.length} marcados presentes</span>
        </h2>

        <p className="texto-apoio" style={{ marginTop: -6, marginBottom: 12 }}>
          O gestor pode lançar a chamada fora do horário da aula — útil para
          regularizar o que o professor não registrou no momento.
        </p>

        <form onSubmit={salvarChamada}>
          <div className="painel">
            <div className="painel-corpo">
              <div className="linha-form">
                <div className="campo">
                  <label htmlFor="ge-data">Data</label>
                  <input
                    id="ge-data"
                    className="entrada mono"
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    style={{ width: 170 }}
                  />
                  <span className="ajuda">Retroativo até 2 dias.</span>
                </div>
                <div className="campo cresce">
                  <label htmlFor="ge-aula">Aula <span className="obrigatorio">*</span></label>
                  <Selecao
                    id="ge-aula"
                    rotuloAria="Aula"
                    valor={atribuicaoId}
                    aoMudar={setAtribuicaoId}
                    vazio="Selecione a aula"
                    desabilitado={!aulas.length}
                    opcoes={aulas.map((a) => ({
                      valor: String(a.atribuicao_id),
                      rotulo: `${a.materia} · ${a.professor_nome} · ${hhmm(a.hora_inicio)}–${hhmm(a.hora_fim)}`,
                    }))}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setPresencas(Object.fromEntries(alunos.map((a) => [a.id, true])))}
                >
                  Marcar todos
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setPresencas(Object.fromEntries(alunos.map((a) => [a.id, false])))}
                >
                  Desmarcar todos
                </button>
                <button type="submit" className="btn btn-primario" disabled={ocupado || !alunos.length || carregandoTurma}>
                  {ocupado ? 'Salvando...' : 'Salvar chamada'}
                </button>
              </div>
            </div>

            <table className="tabela">
              <thead>
                <tr>
                  <th style={{ width: 1 }}>Presente</th>
                  <th>Aluno</th>
                  <th>Matrícula</th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Presença de ${a.nome}`}
                        checked={Boolean(presencas[a.id])}
                        onChange={(e) => setPresencas((p) => ({ ...p, [a.id]: e.target.checked }))}
                      />
                    </td>
                    <td>{a.nome}</td>
                    <td><span className="chip-dado">{a.matricula || '—'}</span></td>
                  </tr>
                ))}
                {!alunos.length && (
                  <tr><td colSpan={3}><div className="vazio">Nenhum aluno para chamar.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </form>
      </section>

      <section className="secao">
        <h2>
          Batidas do dia
          {batidas.length > 0 && (
            <span className="nota">{batidas.length === 1 ? '1 batida' : `${batidas.length} batidas`}</span>
          )}
        </h2>

        <p className="texto-apoio" style={{ marginTop: -6, marginBottom: 12 }}>
          O que o equipamento registrou para os alunos desta turma em{' '}
          <span className="mono">{data.split('-').reverse().join('/')}</span> — sem precisar
          abrir relatório. Atualiza sozinha quando chega batida nova.
        </p>

        <div className="painel">
          <div className="painel-corpo">
            {batidasIndisponivel ? (
              <div className="vazio">Batidas indisponíveis no momento.</div>
            ) : carregandoBatidas ? (
              <div className="vazio">Carregando batidas...</div>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th style={{ width: 1 }}>Hora</th>
                    <th>Aluno</th>
                    <th>Tipo</th>
                    <th>Equipamento</th>
                  </tr>
                </thead>
                <tbody>
                  {batidas.map((b) => (
                    <tr key={b.id}>
                      <td className="mono">{horaDaBatida(b.data_hora)}</td>
                      <td>{b.aluno_nome}</td>
                      <td>{rotuloTipoBatida(b.tipo_batida)}</td>
                      <td>{b.dispositivo_descricao || '—'}</td>
                    </tr>
                  ))}
                  {!batidas.length && (
                    <tr>
                      <td colSpan={4}>
                        <div className="vazio">Nenhuma batida registrada para esta turma nesta data.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
