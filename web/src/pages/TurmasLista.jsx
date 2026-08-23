import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';

const TURNOS = [
  { valor: 'manha', rotulo: 'Manhã' },
  { valor: 'tarde', rotulo: 'Tarde' },
  { valor: 'integral', rotulo: 'Integral' },
  { valor: 'noite', rotulo: 'Noite' },
];

const rotuloTurno = (v) => TURNOS.find((t) => t.valor === v)?.rotulo || v;

const FORM_VAZIO = { nome: '', turno: 'manha', ano_letivo: new Date().getFullYear(), filial_id: '' };

export default function TurmasLista() {
  const [turmas, setTurmas] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const [form, setForm] = useState(null); // null = formulario fechado
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(null);

  const carregar = useCallback(async () => {
    const [turm, unid, alun] = await Promise.allSettled([
      api.listarTurmas(),
      api.listarUnidades(),
      api.listarAlunos(),
    ]);

    if (turm.status === 'fulfilled') setTurmas(turm.value.turmas || []);
    else setErro('Não foi possível carregar as turmas.');

    if (unid.status === 'fulfilled') {
      setEscolas((unid.value.filiais || []).filter((f) => f.tipo === 'escola' && f.ativo));
    }
    if (alun.status === 'fulfilled') setAlunos(alun.value.alunos || []);

    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const alunosPorTurma = useMemo(() => {
    const mapa = new Map();
    alunos.forEach((a) => {
      if (a.turma_id) mapa.set(a.turma_id, (mapa.get(a.turma_id) || 0) + 1);
    });
    return mapa;
  }, [alunos]);

  function abrirNova() {
    setEditandoId(null);
    setForm({ ...FORM_VAZIO, filial_id: escolas[0]?.id || '' });
    setErro(null);
  }

  function abrirEdicao(t) {
    setEditandoId(t.id);
    setForm({ nome: t.nome, turno: t.turno, ano_letivo: t.ano_letivo, filial_id: t.filial_id });
    setErro(null);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(null);
    // O <Selecao> e um <button>, entao nao participa da validacao nativa do
    // formulario como o <select required> fazia. A checagem passa a ser aqui.
    if (!form.filial_id) {
      setErro('Selecione a unidade (escola) da turma.');
      return;
    }
    setSalvando(true);
    try {
      const payload = { ...form, ano_letivo: Number(form.ano_letivo) };
      if (editandoId) await api.atualizarTurma(editandoId, payload);
      else await api.criarTurma(payload);
      setForm(null);
      setEditandoId(null);
      await carregar();
    } catch (err) {
      setErro(err.message || 'Erro ao salvar a turma.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    setErro(null);
    try {
      await api.excluirTurma(id);
      setConfirmandoExclusao(null);
      await carregar();
    } catch (err) {
      setErro(err.message || 'Erro ao excluir a turma.');
      setConfirmandoExclusao(null);
    }
  }

  if (carregando) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;

  return (
    <Layout>
      <div className="barra-acoes">
        <h1 className="titulo-pagina" style={{ margin: 0 }}>Turmas</h1>
        <div className="grupo">
          <button type="button" className="btn btn-azul" onClick={abrirNova} disabled={!escolas.length}>
            + Nova turma
          </button>
        </div>
      </div>

      {erro && <div className="erro">{erro}</div>}

      {!escolas.length && (
        <div className="aviso">
          Nenhuma unidade do tipo <strong>escola</strong> cadastrada. Turmas só podem ser criadas
          em unidades desse tipo — cadastre uma em <Link to="/unidades">Unidades</Link>.
        </div>
      )}

      {form && (
        <div className="card">
          <div className="eyebrow">{editandoId ? 'Editar turma' : 'Nova turma'}</div>
          <div className="card-corpo">
            <form onSubmit={salvar}>
              <div className="grid-form">
                <div className="campo">
                  <label>Nome <span className="obrigatorio">*</span></label>
                  <input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="campo">
                  <label>Unidade (escola) <span className="obrigatorio">*</span></label>
                  <Selecao
                    rotuloAria="Unidade (escola)"
                    valor={form.filial_id}
                    aoMudar={(v) => setForm({ ...form, filial_id: v })}
                    vazio="Selecione a escola"
                    opcoes={escolas.map((f) => ({ valor: f.id, rotulo: f.nome }))}
                  />
                </div>
                <div className="campo">
                  <label>Turno <span className="obrigatorio">*</span></label>
                  <Selecao
                    rotuloAria="Turno"
                    valor={form.turno}
                    aoMudar={(v) => setForm({ ...form, turno: v })}
                    opcoes={TURNOS}
                  />
                </div>
                <div className="campo">
                  <label>Ano letivo <span className="obrigatorio">*</span></label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={form.ano_letivo}
                    onChange={(e) => setForm({ ...form, ano_letivo: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="acoes-form">
                <button type="button" className="btn btn-secundario" onClick={() => setForm(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primario" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="eyebrow">{turmas.length} turma(s)</div>
        <div className="card-corpo">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Unidade</th>
                <th>Turno</th>
                <th>Ano letivo</th>
                <th>Alunos</th>
                <th>Situação</th>
                <th style={{ width: 1 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {turmas.map((t) => (
                <tr key={t.id}>
                  <td><Link to={`/turmas/${t.id}`}>{t.nome}</Link></td>
                  <td>{t.filial_nome}</td>
                  <td>{rotuloTurno(t.turno)}</td>
                  <td className="mono">{t.ano_letivo}</td>
                  <td><span className="chip-dado">{alunosPorTurma.get(t.id) || 0}</span></td>
                  <td>
                    <span className={`badge badge-${t.ativo ? 'ativo' : 'inativo'}`}>
                      {t.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                      <Link to={`/turmas/${t.id}`} className="btn btn-secundario btn-pequeno">Gerenciar</Link>
                      <button type="button" className="btn btn-secundario btn-pequeno" onClick={() => abrirEdicao(t)}>
                        Editar
                      </button>
                      {confirmandoExclusao === t.id ? (
                        <>
                          <button type="button" className="btn btn-perigo btn-pequeno" onClick={() => excluir(t.id)}>
                            Confirmar
                          </button>
                          <button type="button" className="btn btn-secundario btn-pequeno" onClick={() => setConfirmandoExclusao(null)}>
                            Não
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-perigo btn-pequeno" onClick={() => setConfirmandoExclusao(t.id)}>
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {turmas.length === 0 && (
                <tr><td colSpan={7} className="texto-apoio">Nenhuma turma cadastrada ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
