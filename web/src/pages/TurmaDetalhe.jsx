import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';

const DIAS = [
  { valor: 1, rotulo: 'Seg' },
  { valor: 2, rotulo: 'Ter' },
  { valor: 3, rotulo: 'Qua' },
  { valor: 4, rotulo: 'Qui' },
  { valor: 5, rotulo: 'Sex' },
  { valor: 6, rotulo: 'Sáb' },
];

const linhaVazia = () => ({ nome: '', cpf: '', data_nascimento: '', matricula: '', estado: null });

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

/**
 * atualizarAluno faz UPDATE de todos os campos do aluno (ver
 * backend/src/modules/alunos/alunos.service.js). Mandar so o turma_id
 * apagaria nome, cpf e o resto - por isso reenviamos o registro inteiro.
 *
 * A lista aqui precisa cobrir TODO campo que o `.update()` do backend grava.
 * Campo que falta nao da erro: o backend le `dados.campo` como undefined e
 * grava null, apagando em silencio o que ja estava la. Foi o que aconteceu com
 * `matricula`, incluida no UPDATE em 2026-08-31 - vincular um aluno a turma
 * apagava a matricula dele. Ao ver campo novo no `atualizar`, acrescente aqui.
 */
function payloadAluno(aluno, mudancas) {
  return {
    nome: aluno.nome,
    cpf: aluno.cpf,
    matricula: aluno.matricula,
    data_nascimento: aluno.data_nascimento ? String(aluno.data_nascimento).slice(0, 10) : null,
    horario_aluno_id: aluno.horario_aluno_id,
    nome_responsavel: aluno.nome_responsavel,
    contato_responsavel: aluno.contato_responsavel,
    turma_id: aluno.turma_id,
    ativo: aluno.ativo,
    ...mudancas,
  };
}

export default function TurmaDetalhe() {
  const { id } = useParams();

  const [turma, setTurma] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [professoresTurma, setProfessoresTurma] = useState([]);
  const [professoresDisponiveis, setProfessoresDisponiveis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [vinculandoId, setVinculandoId] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const [linhas, setLinhas] = useState([linhaVazia()]);
  const [salvandoLote, setSalvandoLote] = useState(false);

  const [formProf, setFormProf] = useState({ professor_id: '', materia: '', hora_inicio: '07:00', hora_fim: '08:00', dias: [1, 2, 3, 4, 5] });
  const [mostrarFormProf, setMostrarFormProf] = useState(false);

  const [horario, setHorario] = useState(null);
  const [formHorario, setFormHorario] = useState({ hora_entrada: '07:00', hora_saida: '12:00' });
  const [salvandoHorario, setSalvandoHorario] = useState(false);

  const carregar = useCallback(async () => {
    const [t, todosAlunos, profs, usuarios, hor] = await Promise.allSettled([
      api.buscarTurma(id),
      api.listarAlunos(),
      api.listarProfessoresTurma(id),
      api.listarUsuarios(),
      api.listarHorariosTurma(id),
    ]);

    if (hor.status === 'fulfilled') {
      // O backend guarda no maximo uma janela por turma (a query usa limit 1).
      const h = (hor.value.horarios || [])[0] || null;
      setHorario(h);
      setFormHorario({
        hora_entrada: (h?.hora_entrada || '07:00').slice(0, 5),
        hora_saida: (h?.hora_saida || '12:00').slice(0, 5),
      });
    }

    if (t.status === 'fulfilled') setTurma(t.value.turma);
    else setErro('Não foi possível carregar a turma.');

    if (todosAlunos.status === 'fulfilled') setAlunos(todosAlunos.value.alunos || []);
    if (profs.status === 'fulfilled') setProfessoresTurma(profs.value.professores || []);
    if (usuarios.status === 'fulfilled') {
      setProfessoresDisponiveis((usuarios.value.usuarios || []).filter((u) => u.papel === 'professor' && u.ativo));
    }
    setCarregando(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const daTurma = useMemo(() => alunos.filter((a) => a.turma_id === id), [alunos, id]);
  const semTurma = useMemo(
    () => alunos.filter((a) => !a.turma_id && (!turma || a.filial_id === turma.filial_id)),
    [alunos, turma],
  );

  async function vincularExistente() {
    if (!vinculandoId) return;
    const aluno = alunos.find((a) => a.id === vinculandoId);
    if (!aluno) return;
    setOcupado(true);
    setErro(null);
    try {
      await api.atualizarAluno(aluno.id, payloadAluno(aluno, { turma_id: id }));
      setVinculandoId('');
      await carregar();
    } catch (err) {
      setErro(err.message || 'Erro ao vincular o aluno.');
    } finally {
      setOcupado(false);
    }
  }

  async function removerDaTurma(aluno) {
    setOcupado(true);
    setErro(null);
    try {
      await api.atualizarAluno(aluno.id, payloadAluno(aluno, { turma_id: null }));
      await carregar();
    } catch (err) {
      setErro(err.message || 'Erro ao remover o aluno da turma.');
    } finally {
      setOcupado(false);
    }
  }

  /** Janela de funcionamento da turma — o backend faz upsert, uma por turma. */
  async function salvarHorario(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    if (formHorario.hora_saida <= formHorario.hora_entrada) {
      setErro('A saída precisa ser depois da entrada.');
      return;
    }
    setSalvandoHorario(true);
    try {
      await api.salvarHorarioTurma(id, { ...formHorario, ativo: true });
      setAviso('Horário da turma salvo.');
      await carregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o horário.');
    } finally {
      setSalvandoHorario(false);
    }
  }

  async function removerHorario() {
    setErro(null);
    setAviso(null);
    try {
      await api.removerHorarioTurma(id, horario.id);
      setAviso('Horário removido.');
      await carregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível remover o horário.');
    }
  }

  function alterarLinha(i, campo, valor) {
    setLinhas((atual) => atual.map((l, idx) => (idx === i ? { ...l, [campo]: valor, estado: null } : l)));
  }

  async function salvarLote(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setSalvandoLote(true);

    const preenchidas = linhas.filter((l) => l.nome.trim() || l.cpf.trim() || l.matricula.trim());
    const resultados = [];

    // Sequencial de proposito: o backend valida matricula duplicada consultando
    // o banco, e em paralelo duas linhas com a mesma matricula passariam as duas.
    for (const linha of preenchidas) {
      try {
        await api.criarAluno({
          filial_id: turma.filial_id,
          turma_id: id,
          nome: linha.nome.trim(),
          cpf: soDigitos(linha.cpf),
          matricula: linha.matricula.trim(),
          data_nascimento: linha.data_nascimento || null,
        });
        resultados.push({ ok: true });
      } catch (err) {
        resultados.push({ ok: false, mensagem: err.message || 'Erro ao cadastrar.' });
      }
    }

    const comErro = [];
    let sucesso = 0;
    preenchidas.forEach((linha, i) => {
      if (resultados[i].ok) sucesso += 1;
      else comErro.push({ ...linha, estado: resultados[i].mensagem });
    });

    setLinhas(comErro.length ? comErro : [linhaVazia()]);
    setSalvandoLote(false);
    if (sucesso) setAviso(`${sucesso} aluno(s) cadastrado(s) e vinculado(s) à turma.`);
    if (comErro.length) setErro(`${comErro.length} linha(s) não foram salvas — veja o motivo em cada uma.`);
    await carregar();
  }

  async function atribuirProfessor(e) {
    e.preventDefault();
    setErro(null);
    // <Selecao> e um <button>: nao entra na validacao nativa do formulario,
    // entao o campo obrigatorio e conferido aqui.
    if (!formProf.professor_id) {
      setErro('Selecione o professor.');
      return;
    }
    setOcupado(true);
    try {
      await api.atribuirProfessor(id, {
        professor_id: formProf.professor_id,
        materia: formProf.materia,
        hora_inicio: formProf.hora_inicio,
        hora_fim: formProf.hora_fim,
        dias_semana: formProf.dias,
      });
      setMostrarFormProf(false);
      setFormProf({ professor_id: '', materia: '', hora_inicio: '07:00', hora_fim: '08:00', dias: [1, 2, 3, 4, 5] });
      await carregar();
    } catch (err) {
      setErro(err.message || 'Erro ao atribuir o professor.');
    } finally {
      setOcupado(false);
    }
  }

  function alternarDia(d) {
    setFormProf((f) => ({
      ...f,
      dias: f.dias.includes(d) ? f.dias.filter((x) => x !== d) : [...f.dias, d].sort(),
    }));
  }

  if (carregando) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;
  if (!turma) {
    return (
      <Layout>
        <Link to="/turmas" className="link-topo">← Turmas</Link>
        <div className="erro">{erro || 'Turma não encontrada.'}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Link to="/turmas" className="link-topo">← Turmas</Link>
      <h1 className="titulo-pagina">{turma.nome}</h1>

      {erro && <div className="erro">{erro}</div>}
      {aviso && <div className="aviso">{aviso}</div>}

      <div className="metricas">
        <div className="metrica">
          <div className="valor mono">{daTurma.length}</div>
          <div className="label">Alunos na turma</div>
        </div>
        <div className="metrica">
          <div className="valor mono">{professoresTurma.length}</div>
          <div className="label">Professores atribuídos</div>
        </div>
        <div className="metrica">
          <div className="valor mono">{turma.ano_letivo}</div>
          <div className="label">Ano letivo</div>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Horário da turma</div>
        <div className="card-corpo">
          <p className="texto-apoio" style={{ marginTop: 0 }}>
            Janela de entrada e saída da turma. É o que delimita a chamada e a
            presença registrada pelo facial.
          </p>
          <form onSubmit={salvarHorario}>
            <div className="grid-form">
              <div className="campo">
                <label htmlFor="th-entrada">Entrada <span className="obrigatorio">*</span></label>
                <input
                  id="th-entrada"
                  type="time"
                  value={formHorario.hora_entrada}
                  onChange={(e) => setFormHorario({ ...formHorario, hora_entrada: e.target.value })}
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="th-saida">Saída <span className="obrigatorio">*</span></label>
                <input
                  id="th-saida"
                  type="time"
                  value={formHorario.hora_saida}
                  onChange={(e) => setFormHorario({ ...formHorario, hora_saida: e.target.value })}
                  required
                />
              </div>
              <div className="campo">
                <label>Situação</label>
                <span className={`badge badge-${horario ? 'ativo' : 'inativo'}`} style={{ width: 'fit-content' }}>
                  {horario ? 'Definido' : 'Sem horário'}
                </span>
              </div>
            </div>
            <div className="acoes-form">
              {horario && (
                <button type="button" className="btn btn-perigo" onClick={removerHorario} disabled={ocupado}>
                  Remover horário
                </button>
              )}
              <button type="submit" className="btn btn-primario" disabled={salvandoHorario}>
                {salvandoHorario ? 'Salvando...' : (horario ? 'Atualizar horário' : 'Definir horário')}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Alunos da turma</div>
        <div className="card-corpo">
          <div className="barra-acoes">
            <div className="grupo">
              <div className="campo">
                <label>Vincular aluno já cadastrado</label>
                <Selecao
                  rotuloAria="Vincular aluno já cadastrado"
                  valor={vinculandoId}
                  aoMudar={setVinculandoId}
                  desabilitado={!semTurma.length}
                  vazio={semTurma.length ? 'Selecione o aluno' : 'Nenhum aluno sem turma nesta unidade'}
                  opcoes={semTurma.map((a) => ({ valor: a.id, rotulo: `${a.nome} · ${a.matricula}` }))}
                />
              </div>
              <button
                type="button"
                className="btn btn-secundario"
                onClick={vincularExistente}
                disabled={!vinculandoId || ocupado}
              >
                Vincular
              </button>
            </div>
          </div>

          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Matrícula</th>
                <th>Nascimento</th>
                <th>Situação</th>
                <th style={{ width: 1 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {daTurma.map((a) => (
                <tr key={a.id}>
                  <td>{a.nome}</td>
                  <td><span className="chip-dado">{a.matricula}</span></td>
                  <td className="mono">
                    {a.data_nascimento ? new Date(a.data_nascimento).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td>
                    <span className={`badge badge-${a.ativo ? 'ativo' : 'inativo'}`}>
                      {a.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secundario btn-pequeno"
                      onClick={() => removerDaTurma(a)}
                      disabled={ocupado}
                    >
                      Remover da turma
                    </button>
                  </td>
                </tr>
              ))}
              {daTurma.length === 0 && (
                <tr><td colSpan={5} className="texto-apoio">Nenhum aluno vinculado a esta turma.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Adicionar alunos em massa</div>
        <div className="card-corpo">
          <p className="texto-apoio" style={{ marginTop: 0 }}>
            Os alunos são criados já vinculados a <strong>{turma.nome}</strong> e à unidade da turma.
          </p>
          <form onSubmit={salvarLote}>
            <table className="tabela tabela-form">
              <thead>
                <tr>
                  <th>Nome completo <span className="obrigatorio">*</span></th>
                  <th style={{ width: 170 }}>CPF <span className="obrigatorio">*</span></th>
                  <th style={{ width: 165 }}>Nascimento <span className="obrigatorio">*</span></th>
                  <th style={{ width: 150 }}>Matrícula</th>
                  <th style={{ width: 1 }} />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <tr key={i}>
                    <td>
                      <input
                        className={`entrada ${l.estado ? 'erro-campo' : ''}`}
                        value={l.nome}
                        onChange={(e) => alterarLinha(i, 'nome', e.target.value)}
                        placeholder="Nome do aluno"
                      />
                      {l.estado && <span className="aviso-linha">{l.estado}</span>}
                    </td>
                    <td>
                      <input
                        className="entrada mono"
                        value={l.cpf}
                        onChange={(e) => alterarLinha(i, 'cpf', e.target.value)}
                        placeholder="000.000.000-00"
                      />
                    </td>
                    <td>
                      <input
                        className="entrada mono"
                        type="date"
                        value={l.data_nascimento}
                        onChange={(e) => alterarLinha(i, 'data_nascimento', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="entrada mono"
                        value={l.matricula}
                        onChange={(e) => alterarLinha(i, 'matricula', e.target.value)}
                        placeholder="opcional"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secundario btn-pequeno"
                        onClick={() => setLinhas((a) => (a.length > 1 ? a.filter((_, idx) => idx !== i) : [linhaVazia()]))}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="acoes-form">
              <button type="button" className="btn btn-secundario" onClick={() => setLinhas((a) => [...a, linhaVazia()])}>
                + Adicionar linha
              </button>
              <button type="submit" className="btn btn-primario" disabled={salvandoLote}>
                {salvandoLote ? 'Salvando...' : 'Salvar alunos'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Professores</div>
        <div className="card-corpo">
          <table className="tabela">
            <thead>
              <tr>
                <th>Professor</th>
                <th>Matéria</th>
                <th>Dias</th>
                <th>Horário</th>
              </tr>
            </thead>
            <tbody>
              {professoresTurma.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome || p.professor_nome}</td>
                  <td>{p.materia}</td>
                  <td className="mono">
                    {(Array.isArray(p.dias_semana) ? p.dias_semana : [])
                      .map((d) => DIAS.find((x) => x.valor === d)?.rotulo || d)
                      .join(', ') || '—'}
                  </td>
                  <td className="mono">{String(p.hora_inicio).slice(0, 5)} – {String(p.hora_fim).slice(0, 5)}</td>
                </tr>
              ))}
              {professoresTurma.length === 0 && (
                <tr><td colSpan={4} className="texto-apoio">Nenhum professor atribuído.</td></tr>
              )}
            </tbody>
          </table>

          {!mostrarFormProf ? (
            <div className="acoes-form">
              <button
                type="button"
                className="btn btn-azul"
                onClick={() => setMostrarFormProf(true)}
                disabled={!professoresDisponiveis.length}
              >
                + Atribuir professor
              </button>
            </div>
          ) : (
            <form onSubmit={atribuirProfessor} style={{ marginTop: 18 }}>
              <div className="grid-form">
                <div className="campo">
                  <label>Professor <span className="obrigatorio">*</span></label>
                  <Selecao
                    rotuloAria="Professor"
                    valor={formProf.professor_id}
                    aoMudar={(v) => setFormProf({ ...formProf, professor_id: v })}
                    vazio="Selecione o professor"
                    opcoes={professoresDisponiveis.map((p) => ({ valor: p.id, rotulo: `${p.nome} · ${p.email}` }))}
                  />
                </div>
                <div className="campo">
                  <label>Matéria <span className="obrigatorio">*</span></label>
                  <input
                    value={formProf.materia}
                    onChange={(e) => setFormProf({ ...formProf, materia: e.target.value })}
                    required
                  />
                  <span className="ajuda">Obrigatório pelo backend (turma_professores.materia).</span>
                </div>
                <div className="campo">
                  <label>Início <span className="obrigatorio">*</span></label>
                  <input
                    type="time"
                    value={formProf.hora_inicio}
                    onChange={(e) => setFormProf({ ...formProf, hora_inicio: e.target.value })}
                    required
                  />
                </div>
                <div className="campo">
                  <label>Fim <span className="obrigatorio">*</span></label>
                  <input
                    type="time"
                    value={formProf.hora_fim}
                    onChange={(e) => setFormProf({ ...formProf, hora_fim: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="campo" style={{ marginTop: 14 }}>
                <label>Dias da semana</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DIAS.map((d) => (
                    <button
                      key={d.valor}
                      type="button"
                      className={`btn btn-pequeno ${formProf.dias.includes(d.valor) ? 'btn-azul' : 'btn-secundario'}`}
                      onClick={() => alternarDia(d.valor)}
                    >
                      {d.rotulo}
                    </button>
                  ))}
                </div>
              </div>
              <div className="acoes-form">
                <button type="button" className="btn btn-secundario" onClick={() => setMostrarFormProf(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primario" disabled={ocupado}>Atribuir</button>
              </div>
            </form>
          )}

          {!professoresDisponiveis.length && (
            <p className="texto-apoio">
              Nenhum usuário com papel <strong>professor</strong> cadastrado.
              Crie um em <Link to="/usuarios/novo">Usuários</Link>.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
