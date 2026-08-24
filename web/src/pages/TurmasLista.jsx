import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';
import { rotuloTurno } from '../utils/dominio';

export default function TurmasLista() {
  const [turmas, setTurmas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(null);

  const carregar = useCallback(async () => {
    const [turm, alun] = await Promise.allSettled([api.listarTurmas(), api.listarAlunos()]);

    if (turm.status === 'fulfilled') setTurmas(turm.value.turmas || []);
    else setErro('Não foi possível carregar as turmas.');

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
        <div>
          <h1 className="titulo-pagina" style={{ margin: 0 }}>Turmas</h1>
          <p className="subtitulo-pagina" style={{ margin: '3px 0 0' }}>
            {turmas.length === 1 ? '1 turma cadastrada' : `${turmas.length} turmas cadastradas`}
          </p>
        </div>
        <Link to="/turmas/nova" className="btn btn-azul">+ Nova turma</Link>
      </div>

      {erro && <div className="erro">{erro}</div>}

      <div className="painel">
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
                    <Link to={`/turmas/${t.id}/editar`} className="btn btn-secundario btn-pequeno">Editar</Link>
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
              <tr><td colSpan={7}><div className="vazio">Nenhuma turma cadastrada ainda.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
