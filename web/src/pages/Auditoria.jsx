import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { baixarCsv, exportarPdf, limitesDoMes } from '../utils/exportar';
import { dataHoraCompleta, tempoRelativo } from '../utils/conexao';

const POR_PAGINA = 50;

/** Converte o que vier (objeto, string JSON ou null) num objeto navegavel. */
function comoObjeto(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return { valor: String(v) }; }
}

const formatar = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/**
 * Compara antes/depois e devolve so os campos que mudaram.
 *
 * E o coracao da tela: num log com 30 campos, olhar dois JSON lado a lado nao
 * mostra o que aconteceu. A lista de campos alterados mostra.
 */
function camposAlterados(antes, depois) {
  const a = comoObjeto(antes) || {};
  const d = comoObjeto(depois) || {};
  const chaves = [...new Set([...Object.keys(a), ...Object.keys(d)])].sort();
  return chaves
    .map((k) => ({ campo: k, antes: a[k], depois: d[k] }))
    .filter((l) => JSON.stringify(l.antes ?? null) !== JSON.stringify(l.depois ?? null));
}

/** Acoes de escrita ganham cor; leitura fica neutra. */
function classeAcao(acao) {
  const a = String(acao || '').toLowerCase();
  if (/(criar|create|insert|cadastr)/.test(a)) return 'badge-ativo';
  if (/(excluir|delete|remover)/.test(a)) return 'badge-inativo';
  if (/(erro|falha|error|fail)/.test(a)) return 'badge-inativo';
  return 'badge-info';
}

export default function Auditoria() {
  const { usuario } = useAuth();
  const ehSuperAdmin = usuario?.papel === 'super_admin';

  const hoje = new Date();
  const mes = limitesDoMes(hoje.getFullYear(), hoje.getMonth());

  const [filtros, setFiltros] = useState({ de: mes.de, ate: mes.ate, acao: '', entidade: '', usuario_id: '' });
  const [busca, setBusca] = useState('');
  const [logs, setLogs] = useState(null);
  const [paginacao, setPaginacao] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [abertoId, setAbertoId] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const set = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));

  useEffect(() => {
    if (!ehSuperAdmin) return;
    api.listarUsuarios().then((r) => setUsuarios(r.usuarios || [])).catch(() => {});
  }, [ehSuperAdmin]);

  /**
   * A API devolve { logs, paginacao: { pagina, limite, total, total_paginas } }.
   * Paginamos de verdade em vez de puxar um lote grande: auditoria cresce sem
   * parar, e "os 200 mais recentes" esconderia o resto sem avisar.
   */
  const buscar = useCallback(async (pagina = 1) => {
    setCarregando(true);
    setErro(null);
    setAbertoId(null);
    try {
      const r = await api.listarAuditoria({ ...filtros, pagina, limite: POR_PAGINA });
      setLogs(r.logs || []);
      setPaginacao(r.paginacao || null);
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar a auditoria.');
      setLogs(null);
      setPaginacao(null);
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => { if (ehSuperAdmin) buscar(); }, [ehSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtrados = useMemo(() => {
    if (!logs) return null;
    const termo = busca.trim().toLowerCase();
    if (!termo) return logs;
    return logs.filter((l) => JSON.stringify(l).toLowerCase().includes(termo));
  }, [logs, busca]);

  const acoes = useMemo(
    () => [...new Set((logs || []).map((l) => l.acao).filter(Boolean))].sort(),
    [logs],
  );
  const entidades = useMemo(
    () => [...new Set((logs || []).map((l) => l.entidade).filter(Boolean))].sort(),
    [logs],
  );

  function exportar() {
    if (!filtrados?.length) return;
    baixarCsv(`auditoria-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Auditoria'],
      ['Período', `${filtros.de} a ${filtros.ate}`],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
      [],
      ['Quando', 'Usuário', 'Ação', 'Entidade', 'Registro', 'Origem', 'Antes', 'Depois'],
      ...filtrados.map((l) => [
        dataHoraCompleta(l.criado_em),
        l.usuario_nome || l.usuario_id || '',
        l.acao, l.entidade, l.entidade_id || '', l.ip_origem || '',
        JSON.stringify(comoObjeto(l.dados_antes) ?? ''),
        JSON.stringify(comoObjeto(l.dados_depois) ?? ''),
      ]),
    ]);
  }

  if (!ehSuperAdmin) {
    return (
      <Layout>
        <h1 className="titulo-pagina">Auditoria</h1>
        <div className="aviso">
          Esta tela é restrita ao perfil <strong>super admin</strong>. Fale com quem
          administra o sistema se precisar consultar o histórico de alterações.
        </div>
        <Link to="/dashboard" className="btn btn-secundario">Voltar à visão geral</Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="barra-acoes">
        <div>
          <h1 className="titulo-pagina" style={{ margin: 0 }}>Auditoria</h1>
          <p className="subtitulo-pagina" style={{ margin: '3px 0 0' }}>
            Todas as ações registradas. Clique numa linha para ver o log completo.
          </p>
        </div>
        <div className="grupo" style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-secundario" onClick={exportar} disabled={!filtrados?.length}>
            Exportar .csv
          </button>
          <button type="button" className="btn btn-secundario" onClick={exportarPdf} disabled={!filtrados?.length}>
            Exportar .pdf
          </button>
        </div>
      </div>

      {erro && (
        <div className="erro">
          {erro}
          <div style={{ marginTop: 6, fontWeight: 400 }}>
            Se a mensagem for “rota não encontrada”, o módulo existe no servidor
            (<code>auditoria.routes.js</code>) mas não está registrado no <code>app.js</code>.
          </div>
        </div>
      )}

      <div className="filtros nao-imprimir">
        <div className="campo">
          <label htmlFor="au-de">De</label>
          <input id="au-de" type="date" value={filtros.de} onChange={(e) => set('de', e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="au-ate">Até</label>
          <input id="au-ate" type="date" value={filtros.ate} onChange={(e) => set('ate', e.target.value)} />
        </div>
        <div className="campo" style={{ minWidth: 170 }}>
          <label htmlFor="au-acao">Ação</label>
          <Selecao
            id="au-acao" rotuloAria="Ação" valor={filtros.acao} aoMudar={(v) => set('acao', v)}
            opcoes={[{ valor: '', rotulo: 'Todas' }, ...acoes.map((a) => ({ valor: a, rotulo: a }))]}
          />
        </div>
        <div className="campo" style={{ minWidth: 170 }}>
          <label htmlFor="au-ent">Entidade</label>
          <Selecao
            id="au-ent" rotuloAria="Entidade" valor={filtros.entidade} aoMudar={(v) => set('entidade', v)}
            opcoes={[{ valor: '', rotulo: 'Todas' }, ...entidades.map((a) => ({ valor: a, rotulo: a }))]}
          />
        </div>
        <div className="campo" style={{ minWidth: 190 }}>
          <label htmlFor="au-user">Usuário</label>
          <Selecao
            id="au-user" rotuloAria="Usuário" valor={filtros.usuario_id} aoMudar={(v) => set('usuario_id', v)}
            opcoes={[{ valor: '', rotulo: 'Todos' }, ...usuarios.map((u) => ({ valor: u.id, rotulo: u.nome }))]}
          />
        </div>
        <button type="button" className="btn btn-primario" onClick={buscar} disabled={carregando}>
          {carregando ? 'Buscando...' : 'Buscar'}
        </button>
        <div className="espaco" />
        <div className="campo" style={{ minWidth: 200 }}>
          <label htmlFor="au-busca">Filtrar no resultado</label>
          <input
            id="au-busca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="qualquer texto do log"
          />
        </div>
      </div>

      <section className="secao">
        <h2>
          Ações registradas
          {filtrados && (
            <span className="nota">
              {paginacao
                ? `${paginacao.total} ${paginacao.total === 1 ? 'ação' : 'ações'} no período`
                : `${filtrados.length} ${filtrados.length === 1 ? 'ação' : 'ações'}`}
              {busca.trim() && ` · ${filtrados.length} nesta página após o filtro`}
            </span>
          )}
        </h2>

        <div className="painel">
          {carregando && <div className="painel-corpo"><p className="vazio">Carregando...</p></div>}

          {!carregando && filtrados && (
            <table className="tabela">
              <thead>
                <tr>
                  <th style={{ width: 1 }} />
                  <th>Data e hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                  <th>Registro</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l, i) => {
                  const id = l.id ?? i;
                  const aberto = abertoId === id;
                  const alterados = camposAlterados(l.dados_antes, l.dados_depois);
                  return (
                    <Fragment key={id}>
                      <tr
                        className={`auditoria-linha ${aberto ? 'aberta' : ''}`}
                        onClick={() => setAbertoId(aberto ? null : id)}
                      >
                        <td aria-hidden="true" style={{ color: 'var(--azul)' }}>{aberto ? '▾' : '▸'}</td>
                        <td className="mono">
                          {dataHoraCompleta(l.criado_em)}
                          <div className="estado-detalhe">{tempoRelativo(l.criado_em)}</div>
                        </td>
                        <td>{l.usuario_nome || <span className="texto-apoio">{l.usuario_id || 'sistema'}</span>}</td>
                        <td><span className={`badge ${classeAcao(l.acao)}`}>{l.acao}</span></td>
                        <td>{l.entidade}</td>
                        <td className="mono">{l.entidade_id || '—'}</td>
                        <td className="mono">{l.ip_origem || '—'}</td>
                      </tr>

                      {aberto && (
                        <tr className="log-detalhe">
                          <td colSpan={7}>
                            <div className="log-corpo">
                              <dl className="log-meta">
                                <div><dt>Quando</dt><dd className="mono">{dataHoraCompleta(l.criado_em)}</dd></div>
                                <div><dt>Usuário</dt><dd>{l.usuario_nome || '—'}</dd></div>
                                <div><dt>ID do usuário</dt><dd className="mono">{l.usuario_id || '—'}</dd></div>
                                <div><dt>Ação</dt><dd>{l.acao}</dd></div>
                                <div><dt>Entidade</dt><dd>{l.entidade}</dd></div>
                                <div><dt>ID do registro</dt><dd className="mono">{l.entidade_id || '—'}</dd></div>
                                <div><dt>IP de origem</dt><dd className="mono">{l.ip_origem || '—'}</dd></div>
                                <div><dt>ID do log</dt><dd className="mono">{l.id ?? '—'}</dd></div>
                              </dl>

                              <div className="log-bloco">
                                <h4>O que mudou nesta ação</h4>
                                {alterados.length ? (
                                  <table className="log-diff">
                                    <thead>
                                      <tr><th>Campo</th><th>Antes</th><th>Depois</th></tr>
                                    </thead>
                                    <tbody>
                                      {alterados.map((c) => (
                                        <tr key={c.campo}>
                                          <td className="campo-alterado">{c.campo}</td>
                                          <td className="antes">{formatar(c.antes)}</td>
                                          <td className="depois">{formatar(c.depois)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="texto-apoio" style={{ margin: 0 }}>
                                    Nenhuma diferença entre antes e depois — ação de leitura, ou o log
                                    não guardou os dois estados.
                                  </p>
                                )}
                              </div>

                              <div className="log-colunas">
                                <div className="log-bloco">
                                  <h4>Estado antes</h4>
                                  <pre className="log-json">
                                    {l.dados_antes ? JSON.stringify(comoObjeto(l.dados_antes), null, 2) : '— não registrado —'}
                                  </pre>
                                </div>
                                <div className="log-bloco">
                                  <h4>Estado depois</h4>
                                  <pre className="log-json">
                                    {l.dados_depois ? JSON.stringify(comoObjeto(l.dados_depois), null, 2) : '— não registrado —'}
                                  </pre>
                                </div>
                              </div>

                              <div className="log-bloco">
                                <h4>Log bruto</h4>
                                <pre className="log-json">{JSON.stringify(l, null, 2)}</pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="vazio">
                        {logs?.length ? 'Nenhuma ação corresponde ao filtro.' : 'Nenhuma ação registrada no período.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {!carregando && !filtrados && !erro && (
            <div className="painel-corpo"><p className="vazio">Ajuste os filtros e clique em “Buscar”.</p></div>
          )}
        </div>

        {paginacao && paginacao.total_paginas > 1 && (
          <div className="paginacao nao-imprimir">
            <button
              type="button"
              className="btn btn-secundario btn-pequeno"
              onClick={() => buscar(paginacao.pagina - 1)}
              disabled={carregando || paginacao.pagina <= 1}
            >
              ← Anterior
            </button>
            <span className="texto-apoio">
              Página {paginacao.pagina} de {paginacao.total_paginas}
            </span>
            <button
              type="button"
              className="btn btn-secundario btn-pequeno"
              onClick={() => buscar(paginacao.pagina + 1)}
              disabled={carregando || paginacao.pagina >= paginacao.total_paginas}
            >
              Próxima →
            </button>
          </div>
        )}

        {paginacao && paginacao.total_paginas > 1 && (
          <p className="texto-apoio" style={{ marginTop: 8 }}>
            A busca por texto e a exportação valem só para esta página — o filtro de
            período, ação, entidade e usuário é que percorre todo o histórico.
          </p>
        )}
      </section>
    </Layout>
  );
}
