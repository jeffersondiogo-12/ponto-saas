import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import ConfirmarAcaoAviso from '../components/ConfirmarAcaoAviso';
import { useAuth } from '../context/AuthContext';
import { useRecarregarAoVivo } from '../context/RealtimeContext';
import { api } from '../api';
import { rotuloStatusAviso, tomStatusAviso } from '../utils/dominio';

const FILTROS = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'aguardando_data', rotulo: 'Aguardando data' },
  { valor: 'lancado', rotulo: 'Lançados' },
  { valor: 'desativado', rotulo: 'Desativados' },
];

const dataHora = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Lista vazia de alvos = o aviso vale para a empresa inteira. */
function rotuloAlvo(aviso) {
  if (!aviso.alvos?.length) return 'Empresa inteira';
  return aviso.alvos.map((a) => a.turma_nome || a.filial_nome).filter(Boolean).join(', ') || 'Empresa inteira';
}

export default function AvisosLista() {
  const navigate = useNavigate();
  const { pode } = useAuth();
  const [avisos, setAvisos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [confirmando, setConfirmando] = useState(null); // { acao, aviso }
  const [excluindo, setExcluindo] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  /**
   * Uma pergunta por acao, e nao um `podeGerir` unico: a matriz separa
   * adicionar, atualizar e deletar, e nada impede um papel receber so parte
   * disso. Quem so tem `ver` continua vendo a lista, sem botao nenhum.
   */
  const podeCriar = pode('avisos', 'adicionar');
  const podeAlterar = pode('avisos', 'atualizar');
  const podeApagar = pode('avisos', 'deletar');

  const carregar = useCallback(async () => {
    try {
      const r = await api.listarAvisos();
      setAvisos(r.avisos || []);
      setErro(null);
    } catch (err) {
      setErro(err.status === 403 ? 'Você não tem permissão para ver os avisos.' : err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // O agendador publica `aviso.lancado` quando a data chega: a lista troca de
  // "Aguardando data" para "Lançado" sozinha, sem F5.
  const recarregarAoVivo = useCallback(() => { carregar(); }, [carregar]);
  useRecarregarAoVivo(['aviso.lancado', 'aviso.criado', 'aviso.atualizado', 'aviso.removido'], recarregarAoVivo);

  /**
   * Recarga por HORARIO, e nao so por evento.
   *
   * O `aviso.lancado` que marcaria a virada de "Aguardando data" para
   * "Lancado" e publicado pelo AGENDADOR, que roda em outro processo
   * (`npm run avisos:worker`). O `Set` de clientes WebSocket vive na memoria
   * do processo web, entao o evento do worker nao alcanca navegador nenhum —
   * a tela ficava eternamente em "Aguardando data" mesmo com o push ja
   * entregue e o `enviado_em` gravado.
   *
   * A dependencia e a CHAVE dos pendentes, nao a lista de avisos: `carregar()`
   * troca o array a cada consulta, e depender dele recriaria o timer a cada
   * volta, zerando o contador — a tela consultaria para sempre. Com a chave, o
   * efeito so reinicia quando o conjunto de pendentes muda de verdade.
   */
  const chavePendentes = useMemo(
    () => avisos
      .filter((a) => a.status === 'aguardando_data')
      .map((a) => `${a.id}@${a.publicado_em}`)
      .sort()
      .join('|'),
    [avisos],
  );

  useEffect(() => {
    if (!chavePendentes) return undefined;

    const vencimentos = chavePendentes.split('|')
      .map((p) => new Date(p.split('@')[1]).getTime())
      .filter(Number.isFinite);
    if (vencimentos.length === 0) return undefined;

    const agora = Date.now();
    const proximo = Math.min(...vencimentos);
    // 15s de margem porque o worker roda a cada minuto: a hora chegar nao
    // significa que ja processou.
    const espera = proximo <= agora ? 20000 : Math.max(1000, proximo - agora + 15000);

    let tentativas = 0;
    const id = setInterval(() => {
      tentativas += 1;
      carregar();
      // Teto para a tela esquecida aberta nao consultar indefinidamente —
      // acontece quando o worker nao esta rodando e o aviso nunca sai.
      if (tentativas >= 5) clearInterval(id);
    }, espera);
    return () => clearInterval(id);
  }, [chavePendentes, carregar]);

  const visiveis = useMemo(
    () => (filtro ? avisos.filter((a) => a.status === filtro) : avisos),
    [avisos, filtro],
  );

  async function executar(acao, alvo, quando) {
    setErro(null); setAviso(null); setOcupado(true);
    try {
      if (acao === 'reativar') {
        await api.ativarAviso(alvo.id);
        setAviso(`“${alvo.titulo}” voltou ao mural. Ninguém foi notificado.`);
      } else if (acao === 'reenviar') {
        await api.reenviarAviso(alvo.id, quando);
        setAviso(`Novo aviso criado a partir de “${alvo.titulo}”.`);
      }
      setConfirmando(null);
      await carregar();
    } finally {
      // Sem catch de proposito: o erro sobe para o modal, que o exibe e mantem
      // a tela aberta em vez de fechar e perder o que a pessoa ja escolheu.
      setOcupado(false);
    }
  }

  async function desativar(alvo) {
    setErro(null); setAviso(null); setOcupado(true);
    try {
      await api.desativarAviso(alvo.id);
      setAviso(`“${alvo.titulo}” saiu do mural do aplicativo.`);
      await carregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível desativar o aviso.');
    } finally {
      setOcupado(false);
    }
  }

  async function excluir(alvo) {
    setErro(null); setAviso(null); setOcupado(true);
    try {
      await api.excluirAviso(alvo.id);
      setAviso(`“${alvo.titulo}” foi excluído.`);
      await carregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível excluir o aviso.');
    } finally {
      setExcluindo(null);
      setOcupado(false);
    }
  }

  if (carregando) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;

  return (
    <Layout>
      <h1 className="titulo-pagina">Avisos</h1>
      <p className="subtitulo-pagina">
        Comunicados enviados aos responsáveis pelo aplicativo. Um aviso agendado
        só sai na data marcada — até lá, dá para editar ou excluir.
      </p>

      {erro && <div className="erro">{erro}</div>}
      {aviso && <div className="sucesso">{aviso}</div>}

      <div className="filtros">
        <div className="campo">
          <label htmlFor="av-filtro">Exibir</label>
          <Selecao id="av-filtro" rotuloAria="Situação do aviso" valor={filtro} aoMudar={setFiltro} opcoes={FILTROS} />
        </div>
        {podeCriar && (
          <button className="btn btn-primario" onClick={() => navigate('/avisos/novo')}>
            Criar aviso
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-corpo">
          <table className="tabela">
              <thead>
                <tr>
                  <th>Aviso</th>
                  <th>Para</th>
                  <th>Envio</th>
                  <th>Situação</th>
                  <th>Leram</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((a) => {
                  const agendado = a.status === 'aguardando_data';
                  const desativado = a.status === 'desativado';
                  // Espelha o backend: excluir so em aguardando_data ou desativado.
                  const podeExcluir = agendado || desativado;
                  return (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.titulo}</strong>
                        <div className="texto-apoio" style={{ marginTop: 2 }}>{a.mensagem}</div>
                      </td>
                      <td>{rotuloAlvo(a)}</td>
                      <td className="mono">{dataHora(a.publicado_em)}</td>
                      <td>
                        <span className={`badge badge-${tomStatusAviso(a.status)}`}>
                          {rotuloStatusAviso(a.status)}
                        </span>
                      </td>
                      <td className="mono">
                        {a.status === 'aguardando_data'
                          ? '—'
                          : `${a.total_leram} de ${a.total_destinatarios}`}
                      </td>
                      <td>
                        {(podeAlterar || podeApagar) && (
                          <div className="acoes-form" style={{ margin: 0, justifyContent: 'flex-start' }}>
                            {agendado && podeAlterar && (
                              <Link to={`/avisos/${a.id}/editar`} className="btn btn-secundario btn-pequeno">
                                Editar
                              </Link>
                            )}
                            {!podeAlterar ? null : desativado ? (
                              <button
                                type="button"
                                className="btn btn-verde btn-pequeno"
                                disabled={ocupado}
                                onClick={() => setConfirmando({ acao: 'reativar', aviso: a })}
                              >
                                Reativar
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secundario btn-pequeno"
                                disabled={ocupado}
                                onClick={() => desativar(a)}
                              >
                                Desativar
                              </button>
                            )}
                            {a.status === 'lancado' && podeCriar && (
                              <button
                                type="button"
                                className="btn btn-secundario btn-pequeno"
                                disabled={ocupado}
                                onClick={() => setConfirmando({ acao: 'reenviar', aviso: a })}
                              >
                                Enviar de novo
                              </button>
                            )}
                            {podeExcluir && podeApagar && (
                              excluindo === a.id ? (
                                <>
                                  <button type="button" className="btn btn-perigo btn-pequeno" disabled={ocupado} onClick={() => excluir(a)}>
                                    Confirmar
                                  </button>
                                  <button type="button" className="btn btn-secundario btn-pequeno" onClick={() => setExcluindo(null)}>
                                    Não
                                  </button>
                                </>
                              ) : (
                                <button type="button" className="btn btn-perigo btn-pequeno" onClick={() => setExcluindo(a.id)}>
                                  Excluir
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visiveis.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="vazio">
                        {filtro ? 'Nenhum aviso nesta situação.' : 'Nenhum aviso criado ainda.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
          </table>
        </div>
      </div>

      {confirmando && (
        <ConfirmarAcaoAviso
          acao={confirmando.acao}
          aviso={confirmando.aviso}
          aoFechar={() => setConfirmando(null)}
          aoConfirmar={(quando) => executar(confirmando.acao, confirmando.aviso, quando)}
        />
      )}
    </Layout>
  );
}
