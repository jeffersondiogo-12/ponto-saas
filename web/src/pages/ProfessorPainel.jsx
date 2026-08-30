import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';
import { dataHoraCompleta } from '../utils/conexao';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const hoje = () => new Date().toISOString().slice(0, 10);
const hhmm = (v) => String(v || '').slice(0, 5);

/** dias_semana chega como array ou como JSON em texto, dependendo do driver. */
function comoDias(v) {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v || '[]'); } catch { return []; }
}

/**
 * A observacao passa por `validarAulaNoMomento` no servidor: so e aceita no
 * DIA da aula e DENTRO do horario dela. A conta aqui e a mesma, feita pelo
 * relogio do navegador, e serve so para avisar antes - quem decide continua
 * sendo o servidor, que usa o fuso da filial. Por isso isto NAO bloqueia o
 * envio: se o fuso do computador estiver diferente do da escola, bloquear
 * impediria um lancamento legitimo.
 */
function janelaDaAula(aula) {
  if (!aula) return null;
  const dias = comoDias(aula.dias_semana);
  const agora = new Date();
  const noDia = dias.includes(agora.getDay());
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  const emMinutos = (v) => {
    const [h, m] = String(v || '').split(':');
    return Number(h) * 60 + Number(m || 0);
  };
  const noHorario = minutos >= emMinutos(aula.hora_inicio) && minutos <= emMinutos(aula.hora_fim);
  return {
    aberta: noDia && noHorario,
    dias: dias.map((d) => DIAS[d]).join(', ') || 'nenhum dia definido',
    horario: `${hhmm(aula.hora_inicio)} às ${hhmm(aula.hora_fim)}`,
  };
}

/**
 * O backend grava `etapa` como `Bimestre N` a partir do numero, e exige
 * `tipo_avaliacao` nao-vazio. Sao dois campos separados de proposito: dois
 * lancamentos do mesmo bimestre so se distinguem pelo tipo.
 */
const BIMESTRES = [1, 2, 3, 4].map((n) => ({ valor: String(n), rotulo: `${n}º bimestre` }));
const TIPOS_AVALIACAO = ['Prova', 'Trabalho', 'Atividade', 'Participação', 'Seminário', 'Recuperação']
  .map((v) => ({ valor: v, rotulo: v }));

const rotuloAula = (a) =>
  `${a.materia} · ${hhmm(a.hora_inicio)}–${hhmm(a.hora_fim)} · ${comoDias(a.dias_semana).map((d) => DIAS[d]).join(', ') || 'sem dias'}`;

export default function ProfessorPainel() {
  const [turmas, setTurmas] = useState([]);
  const [atribuicaoId, setAtribuicaoId] = useState('');
  const [alunos, setAlunos] = useState([]);
  const [grade, setGrade] = useState(null);

  const [data, setData] = useState(hoje());
  const [presencas, setPresencas] = useState({});
  const [historicos, setHistoricos] = useState({});

  const [nota, setNota] = useState({ aluno_id: '', valor: '', bimestre: '1', tipo_avaliacao: 'Prova', observacao: '' });
  const [obs, setObs] = useState({ aluno_id: '', texto: '' });

  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const aula = useMemo(
    () => turmas.find((t) => String(t.atribuicao_id) === String(atribuicaoId)) || null,
    [turmas, atribuicaoId],
  );

  /**
   * A janela depende da HORA, nao so da aula escolhida: sem um tique o aviso
   * ficaria congelado no estado de quando a tela abriu, e continuaria dizendo
   * "fora do horario" depois de a aula ter comecado. Um minuto basta - a
   * precisao aqui e de minuto, e o servidor continua sendo quem decide.
   */
  const [, marcarMinuto] = useState(0);
  useEffect(() => {
    if (!aula) return undefined;
    const timer = setInterval(() => marcarMinuto((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, [aula]);

  // Sem memo de proposito: o resultado depende do relogio, e a conta e barata.
  const janela = janelaDaAula(aula);

  useEffect(() => {
    api.listarMinhasTurmas()
      .then((r) => {
        const lista = r.turmas || [];
        setTurmas(lista);
        if (lista[0]) setAtribuicaoId(String(lista[0].atribuicao_id));
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const carregarAula = useCallback(async () => {
    if (!aula) return;
    setErro('');
    setHistoricos({});
    const [al, gr] = await Promise.allSettled([
      api.listarAlunosDaTurma(aula.turma_id, aula.atribuicao_id),
      api.gradeDaTurma(aula.turma_id),
    ]);

    if (al.status === 'fulfilled') {
      const lista = al.value.alunos || [];
      setAlunos(lista);
      // Parte de quem o facial ja detectou hoje: a chamada vira conferencia,
      // nao digitacao do zero.
      setPresencas(Object.fromEntries(lista.map((a) => [a.id, Boolean(a.presenca_facial)])));
    } else {
      setErro(al.reason?.message || 'Não foi possível carregar os alunos.');
      setAlunos([]);
    }

    if (gr.status === 'fulfilled') setGrade(gr.value); else setGrade(null);
  }, [aula]);

  useEffect(() => { carregarAula(); }, [carregarAula]);

  const totalPresentes = useMemo(
    () => alunos.filter((a) => presencas[a.id]).length,
    [alunos, presencas],
  );
  const divergentes = useMemo(
    () => alunos.filter((a) => Boolean(a.presenca_facial) !== Boolean(presencas[a.id])),
    [alunos, presencas],
  );

  function marcarTodos(valor) {
    setPresencas(Object.fromEntries(alunos.map((a) => [a.id, valor])));
  }

  async function salvarPresencas(e) {
    e.preventDefault();
    setErro(''); setMensagem(''); setOcupado(true);
    try {
      await api.registrarPresencasSala(aula.turma_id, {
        data,
        atribuicao_id: aula.atribuicao_id,
        presencas: alunos.map((a) => ({ aluno_id: a.id, presente: Boolean(presencas[a.id]) })),
      });
      setMensagem(`Chamada de ${data.split('-').reverse().join('/')} registrada — ${totalPresentes} de ${alunos.length} presentes.`);
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function salvarNota(e) {
    e.preventDefault();
    setErro(''); setMensagem('');
    if (!nota.aluno_id) { setErro('Selecione o aluno para lançar a nota.'); return; }
    const valor = Number(String(nota.valor).replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0 || valor > 10) { setErro('A nota precisa estar entre 0 e 10.'); return; }
    // <Selecao> e um <button>: nao participa da validacao nativa do formulario.
    if (!String(nota.tipo_avaliacao || '').trim()) { setErro('Escolha o tipo da avaliação.'); return; }

    setOcupado(true);
    try {
      await api.criarNotaProfessor(aula.turma_id, {
        atribuicao_id: aula.atribuicao_id,
        aluno_id: nota.aluno_id,
        disciplina: aula.materia,
        bimestre: Number(nota.bimestre),
        tipo_avaliacao: nota.tipo_avaliacao,
        nota: valor,
        observacao: nota.observacao.trim() || null,
      });
      setMensagem('Nota lançada e visível para o responsável.');
      setNota((n) => ({ ...n, valor: '', observacao: '' }));
      setHistoricos((h) => ({ ...h, [nota.aluno_id]: undefined }));
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  }

  async function salvarObservacao(e) {
    e.preventDefault();
    setErro(''); setMensagem('');
    if (!obs.aluno_id) { setErro('Selecione o aluno da observação.'); return; }
    if (!obs.texto.trim()) { setErro('Escreva a observação.'); return; }

    setOcupado(true);
    try {
      await api.criarObservacaoProfessor(aula.turma_id, {
        atribuicao_id: aula.atribuicao_id,
        aluno_id: obs.aluno_id,
        titulo: `Observação de ${aula.materia}`,
        texto: obs.texto.trim(),
      });
      setMensagem('Observação enviada ao responsável.');
      setObs({ aluno_id: obs.aluno_id, texto: '' });
      setHistoricos((h) => ({ ...h, [obs.aluno_id]: undefined }));
    } catch (err) {
      // O servidor reaproveita `validarAulaNoMomento` aqui, entao a recusa vem
      // escrita como se fosse a chamada. Dizer "chamada" a quem esta mandando
      // uma observacao manda a pessoa conferir a tela errada.
      const fora = /chamada so pode ser registrada|chamada só pode ser registrada/i.test(err.message || '');
      setErro(fora && janela
        ? `A observação só pode ser enviada durante a aula — ${janela.dias}, das ${janela.horario}.`
        : err.message);
    } finally {
      setOcupado(false);
    }
  }

  /** Histórico é carregado sob demanda: 30 alunos seriam 30 requisições. */
  async function alternarHistorico(alunoId) {
    if (historicos[alunoId]) { setHistoricos((h) => ({ ...h, [alunoId]: undefined })); return; }
    setHistoricos((h) => ({ ...h, [alunoId]: { carregando: true } }));
    try {
      const r = await api.historicoDoAluno(aula.turma_id, alunoId, aula.atribuicao_id);
      setHistoricos((h) => ({ ...h, [alunoId]: { notas: r.notas || [], observacoes: r.observacoes || [] } }));
    } catch (err) {
      setHistoricos((h) => ({ ...h, [alunoId]: { erro: err.message } }));
    }
  }

  if (carregando) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;

  if (!turmas.length) {
    return (
      <Layout>
        <h1 className="titulo-pagina">Minhas turmas</h1>
        {erro && <div className="erro">{erro}</div>}
        <div className="aviso">
          Você ainda não está atribuído a nenhuma turma. Quem faz a atribuição é a
          coordenação, na tela de gestão da turma.
        </div>
      </Layout>
    );
  }

  const opcoesAluno = alunos.map((a) => ({ valor: a.id, rotulo: `${a.nome} · ${a.matricula || 'sem matrícula'}` }));

  return (
    <Layout>
      <h1 className="titulo-pagina">Minhas turmas</h1>
      <p className="subtitulo-pagina">
        {aula ? `${aula.nome} · ${aula.materia}` : 'Escolha a aula'}
        {grade?.janela_turma && ` · turma funciona das ${hhmm(grade.janela_turma.hora_entrada)} às ${hhmm(grade.janela_turma.hora_saida)}`}
      </p>

      {erro && <div className="erro">{erro}</div>}
      {mensagem && <div className="sucesso">{mensagem}</div>}

      <div className="filtros">
        <div className="campo" style={{ minWidth: 320 }}>
          <label htmlFor="pp-aula">Aula</label>
          <Selecao
            id="pp-aula"
            rotuloAria="Aula"
            valor={atribuicaoId}
            aoMudar={setAtribuicaoId}
            opcoes={turmas.map((t) => ({ valor: String(t.atribuicao_id), rotulo: `${t.nome} — ${rotuloAula(t)}` }))}
          />
        </div>
      </div>

      {aula && (
        <>
          <section className="secao">
            <div className="numeros">
              <div className="numero"><div className="valor">{alunos.length}</div><div className="label">Alunos na turma</div></div>
              <div className="numero ok"><div className="valor">{totalPresentes}</div><div className="label">Marcados presentes</div></div>
              <div className={`numero ${divergentes.length ? 'destaque' : ''}`}>
                <div className="valor">{divergentes.length}</div>
                <div className="label">Divergem do facial</div>
              </div>
              <div className="numero"><div className="valor">{alunos.filter((a) => a.presenca_facial).length}</div><div className="label">Detectados pelo facial</div></div>
            </div>
          </section>

          <section className="secao">
            <h2>
              Chamada
              {divergentes.length > 0 && <span className="nota">{divergentes.length} diferente(s) do facial</span>}
            </h2>

            <form onSubmit={salvarPresencas}>
              <div className="painel">
                <div className="painel-corpo">
                  <div className="linha-form">
                    <div className="campo">
                      <label htmlFor="pp-data">Data da aula</label>
                      <input
                        id="pp-data"
                        className="entrada mono"
                        type="date"
                        value={data}
                        onChange={(e) => setData(e.target.value)}
                        style={{ width: 170 }}
                      />
                      <span className="ajuda">Retroativo até 2 dias.</span>
                    </div>
                    <button type="button" className="btn btn-secundario" onClick={() => marcarTodos(true)}>
                      Marcar todos
                    </button>
                    <button type="button" className="btn btn-secundario" onClick={() => marcarTodos(false)}>
                      Desmarcar todos
                    </button>
                    <div className="espaco" style={{ flex: 1 }} />
                    <button type="submit" className="btn btn-primario" disabled={ocupado || !alunos.length}>
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
                      <th>Facial hoje</th>
                      <th style={{ width: 1 }}>Histórico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alunos.map((a) => {
                      const diverge = Boolean(a.presenca_facial) !== Boolean(presencas[a.id]);
                      const h = historicos[a.id];
                      return (
                        <Fragment key={a.id}>
                          <tr>
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
                            <td>
                              <span className={`badge badge-${a.presenca_facial ? 'ativo' : 'inativo'}`}>
                                {a.presenca_facial ? 'Detectado' : 'Sem registro'}
                              </span>
                              {diverge && <span className="estado-detalhe">difere da chamada</span>}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-secundario btn-pequeno"
                                onClick={() => alternarHistorico(a.id)}
                              >
                                {h ? 'Fechar' : 'Ver'}
                              </button>
                            </td>
                          </tr>
                          {h && (
                            <tr className="log-detalhe">
                              <td colSpan={5}>
                                <div className="log-corpo">
                                  {h.carregando && <p className="vazio">Carregando histórico...</p>}
                                  {h.erro && <div className="erro" style={{ margin: 0 }}>{h.erro}</div>}
                                  {h.notas && (
                                    <>
                                      <div className="log-bloco">
                                        <h4>Notas de {aula.materia}</h4>
                                        {h.notas.length ? (
                                          <table className="log-diff">
                                            <thead><tr><th>Etapa</th><th>Tipo</th><th>Nota</th><th>Observação</th><th>Quando</th></tr></thead>
                                            <tbody>
                                              {h.notas.map((n) => (
                                                <tr key={n.id}>
                                                  <td>{n.etapa}</td>
                                                  <td>{n.tipo_avaliacao || '—'}</td>
                                                  <td className="mono">{n.nota}</td>
                                                  <td>{n.observacao || '—'}</td>
                                                  <td className="mono">{dataHoraCompleta(n.created_at)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        ) : <p className="texto-apoio" style={{ margin: 0 }}>Nenhuma nota lançada ainda.</p>}
                                      </div>
                                      <div className="log-bloco">
                                        <h4>Observações</h4>
                                        {h.observacoes.length ? (
                                          <table className="log-diff">
                                            <thead><tr><th>Título</th><th>Texto</th><th>Autor</th><th>Quando</th></tr></thead>
                                            <tbody>
                                              {h.observacoes.map((o) => (
                                                <tr key={o.id}>
                                                  <td>{o.titulo}</td>
                                                  <td>{o.texto}</td>
                                                  <td>{o.autor_nome || '—'}</td>
                                                  <td className="mono">{dataHoraCompleta(o.created_at)}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        ) : <p className="texto-apoio" style={{ margin: 0 }}>Nenhuma observação registrada.</p>}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {alunos.length === 0 && (
                      <tr><td colSpan={5}><div className="vazio">Nenhum aluno ativo nesta turma.</div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </form>
          </section>

          <div className="colunas">
            <section className="secao">
              <h2>Lançar nota</h2>
              <div className="painel"><div className="painel-corpo">
                <form onSubmit={salvarNota}>
                  <div className="grid-form">
                    <div className="campo">
                      <label htmlFor="pp-nota-aluno">Aluno <span className="obrigatorio">*</span></label>
                      <Selecao
                        id="pp-nota-aluno" rotuloAria="Aluno" valor={nota.aluno_id}
                        aoMudar={(v) => setNota((n) => ({ ...n, aluno_id: v }))}
                        vazio="Selecione o aluno" opcoes={opcoesAluno}
                      />
                    </div>
                    <div className="campo">
                      <label htmlFor="pp-bimestre">Bimestre <span className="obrigatorio">*</span></label>
                      <Selecao
                        id="pp-bimestre" rotuloAria="Bimestre" valor={nota.bimestre}
                        aoMudar={(v) => setNota((n) => ({ ...n, bimestre: v }))}
                        opcoes={BIMESTRES}
                      />
                    </div>
                    <div className="campo">
                      <label htmlFor="pp-tipo">Tipo da avaliação <span className="obrigatorio">*</span></label>
                      <Selecao
                        id="pp-tipo" rotuloAria="Tipo da avaliação" valor={nota.tipo_avaliacao}
                        aoMudar={(v) => setNota((n) => ({ ...n, tipo_avaliacao: v }))}
                        opcoes={TIPOS_AVALIACAO}
                      />
                    </div>
                    <div className="campo">
                      <label htmlFor="pp-valor">Nota (0 a 10) <span className="obrigatorio">*</span></label>
                      <input
                        id="pp-valor"
                        type="number"
                        min="0"
                        max="10"
                        step="0.01"
                        value={nota.valor}
                        onChange={(e) => setNota((n) => ({ ...n, valor: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="campo">
                      <label htmlFor="pp-nota-obs">Comentário</label>
                      <input
                        id="pp-nota-obs"
                        value={nota.observacao}
                        onChange={(e) => setNota((n) => ({ ...n, observacao: e.target.value }))}
                        placeholder="opcional"
                      />
                    </div>
                  </div>
                  <div className="acoes-form">
                    <button type="submit" className="btn btn-primario" disabled={ocupado}>Lançar nota</button>
                  </div>
                </form>
              </div></div>
            </section>

            <section className="secao">
              <h2>Observação para o responsável</h2>
              <div className="painel"><div className="painel-corpo">
                {janela && !janela.aberta && (
                  <p className="info">
                    O servidor só aceita observação durante a aula — {janela.dias}, das {janela.horario}.
                    Fora desse horário o envio é recusado.
                  </p>
                )}
                <form onSubmit={salvarObservacao}>
                  <div className="campo">
                    <label htmlFor="pp-obs-aluno">Aluno <span className="obrigatorio">*</span></label>
                    <Selecao
                      id="pp-obs-aluno" rotuloAria="Aluno" valor={obs.aluno_id}
                      aoMudar={(v) => setObs((o) => ({ ...o, aluno_id: v }))}
                      vazio="Selecione o aluno" opcoes={opcoesAluno}
                    />
                  </div>
                  <div className="campo" style={{ marginTop: 14 }}>
                    <label htmlFor="pp-obs-texto">Observação <span className="obrigatorio">*</span></label>
                    <textarea
                      id="pp-obs-texto"
                      rows={4}
                      value={obs.texto}
                      onChange={(e) => setObs((o) => ({ ...o, texto: e.target.value }))}
                      placeholder="O responsável vê esta mensagem no aplicativo."
                    />
                  </div>
                  <div className="acoes-form">
                    <button type="submit" className="btn btn-primario" disabled={ocupado}>Enviar observação</button>
                  </div>
                </form>
              </div></div>
            </section>
          </div>

          <section className="secao">
            <h2>
              Grade da turma
              {grade?.aulas?.length > 0 && <span className="nota">{grade.aulas.length} aula(s)</span>}
            </h2>
            <div className="painel">
              <table className="tabela">
                <thead>
                  <tr><th>Matéria</th><th>Professor</th><th>Dias</th><th>Horário</th></tr>
                </thead>
                <tbody>
                  {(grade?.aulas || []).map((a) => (
                    <tr key={a.atribuicao_id}>
                      <td>{a.materia}</td>
                      <td>{a.professor_nome}</td>
                      <td className="mono">{comoDias(a.dias_semana).map((d) => DIAS[d]).join(', ') || '—'}</td>
                      <td className="mono">{hhmm(a.hora_inicio)} – {hhmm(a.hora_fim)}</td>
                    </tr>
                  ))}
                  {!grade?.aulas?.length && (
                    <tr><td colSpan={4}><div className="vazio">Nenhuma aula cadastrada nesta turma.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}
