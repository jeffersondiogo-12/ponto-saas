import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ConfirmarExclusaoAluno from '../components/ConfirmarExclusaoAluno';
import FichaAluno, { ResponsavelVinculado } from '../components/FichaAluno';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import FotoDoAluno from '../components/FotoDoAluno';

// Cartoes ou lista: preferencia de quem olha, lembrada so neste navegador.
const CHAVE_VISAO = 'ponto_saas_alunos_visao';
function lerVisao() {
  try {
    return localStorage.getItem(CHAVE_VISAO) === 'lista' ? 'lista' : 'cards';
  } catch {
    return 'cards';
  }
}

export default function AlunosLista() {
  const navigate = useNavigate();
  const { filialSelecionada, usuario } = useAuth();
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [aExcluir, setAExcluir] = useState(null);
  const [aberto, setAberto] = useState(null);
  const [visao, setVisao] = useState(lerVisao);

  // O backend so aceita DELETE de super_admin, admin e rh (alunos.routes.js);
  // esconder o botao dos demais evita oferecer uma acao que daria 403.
  const podeExcluir = ['super_admin', 'admin', 'rh'].includes(usuario?.papel);

  // Sem unidade escolhida, admin e super_admin escolhem a escola no proprio
  // AlunoForm - e o caso de um ambiente novo, em que a unidade foi criada
  // depois de entrar e nada a selecionou. Com unidade escolhida, ela precisa
  // ser escola: o backend recusa (403) aluno fora da unidade do X-Filial-Id.
  const podeCadastrar = filialSelecionada
    ? filialSelecionada.tipo === 'escola'
    : ['super_admin', 'admin'].includes(usuario?.papel);

  const carregar = useCallback(async () => {
    try {
      const r = await api.listarAlunos();
      setAlunos(r.alunos || []);
      setErro(null);
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar os alunos.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function trocarVisao(nova) {
    setVisao(nova);
    try {
      localStorage.setItem(CHAVE_VISAO, nova);
    } catch {
      // Sem armazenamento (aba anonima, bloqueio): a escolha vale so nesta visita.
    }
  }

  async function aoExcluir(aluno) {
    setAExcluir(null);
    setAviso(`“${aluno.nome}” foi excluído permanentemente.`);
    await carregar();
  }

  return (
    <Layout>
      <h1 className="titulo-pagina">Alunos</h1>

      {erro && <div className="erro">{erro}</div>}
      {aviso && <div className="sucesso">{aviso}</div>}

      <div className="alunos-barra">
        {podeCadastrar && (
          <button className="btn btn-primario" onClick={() => navigate('/alunos/novo')}>Cadastrar aluno</button>
        )}
        <div className="alternar-visao" role="group" aria-label="Forma de exibir os alunos">
          <button type="button" aria-pressed={visao === 'cards'} onClick={() => trocarVisao('cards')}>Cartões</button>
          <button type="button" aria-pressed={visao === 'lista'} onClick={() => trocarVisao('lista')}>Lista</button>
        </div>
      </div>

      {visao === 'cards' && (
        carregando ? (
          <p className="texto-apoio">Carregando...</p>
        ) : alunos.length === 0 ? (
          <div className="card"><div className="card-corpo"><div className="vazio">Nenhum aluno cadastrado ainda.</div></div></div>
        ) : (
          <ul className="alunos-grade">
            {alunos.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`aluno-card ${a.ativo ? '' : 'inativo'}`}
                  aria-label={`${a.nome}${a.ativo ? '' : ' (inativo)'} — abrir ficha`}
                  onClick={() => { setAviso(null); setAberto(a); }}
                >
                  <FotoDoAluno alunoId={a.id} nome={a.nome} temFoto={a.tem_foto}>
                    {/* O resumo cobre a moldura no hover; a ficha completa abre no clique. */}
                    <span className="aluno-resumo" aria-hidden="true">
                      <span>{a.turma_nome || 'Sem turma'}</span>
                      <span className="mono">{a.matricula ? `Matrícula ${a.matricula}` : 'Sem matrícula'}</span>
                      {'responsaveis_vinculados' in a && (
                        <ResponsavelVinculado quantidade={a.responsaveis_vinculados} />
                      )}
                    </span>
                  </FotoDoAluno>
                  <span className="aluno-nome">{a.nome}</span>
                  {!a.ativo && <span className="badge badge-inativo">Inativo</span>}
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {visao === 'lista' && (
        <div className="card">
          <div className="card-corpo">
            {carregando ? (
              <p className="texto-apoio">Carregando...</p>
            ) : (
              <table className="tabela">
                <thead>
                  <tr><th>Nome</th><th>Matrícula</th><th>Turma</th><th>Ações</th></tr>
                </thead>
                <tbody>
                  {alunos.map((a) => (
                    <tr key={a.id}>
                      <td>{a.nome}</td>
                      <td className="mono">{a.matricula || '—'}</td>
                      <td>{a.turma_nome || ''}</td>
                      <td>
                        <div className="acoes-form" style={{ margin: 0, justifyContent: 'flex-start' }}>
                          <button
                            type="button"
                            className="btn btn-secundario btn-pequeno"
                            onClick={() => navigate(`/alunos/${a.id}/editar`)}
                          >
                            Editar
                          </button>
                          {podeExcluir && (
                            <button
                              type="button"
                              className="btn btn-perigo btn-pequeno"
                              onClick={() => { setAviso(null); setAExcluir(a); }}
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {alunos.length === 0 && (
                    <tr><td colSpan={4}><div className="vazio">Nenhum aluno cadastrado ainda.</div></td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {aberto && (
        <FichaAluno
          aluno={aberto}
          podeExcluir={podeExcluir}
          aoFechar={() => setAberto(null)}
          aoEditar={() => navigate(`/alunos/${aberto.id}/editar`)}
          aoExcluir={() => { setAExcluir(aberto); setAberto(null); }}
        />
      )}

      {aExcluir && (
        <ConfirmarExclusaoAluno
          aluno={aExcluir}
          aoFechar={() => setAExcluir(null)}
          aoExcluir={aoExcluir}
        />
      )}
    </Layout>
  );
}
