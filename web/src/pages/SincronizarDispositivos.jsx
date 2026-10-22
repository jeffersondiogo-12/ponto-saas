import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import UsuariosDoEquipamento from '../components/UsuariosDoEquipamento';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { matriculaServeDeId } from '../utils/fotoAluno';

// A rota de envio aceita ate 500 alunos por pedido; acima disso, vai em partes.
const LOTE = 500;

const RESULTADO = {
  enviado: { rotulo: 'Enviado', classe: 'badge-ok' },
  pendente: { rotulo: 'Na fila do equipamento', classe: 'badge-atencao' },
  erro: { rotulo: 'Não enviado', classe: 'badge-erro' },
};

/**
 * Por que o aluno nao pode ir ao equipamento - a trava, ja escrita para a
 * pessoa. As mesmas regras que o servidor confere (faceSync.service.js), aqui
 * para ninguem marcar quem vai voltar recusado.
 */
function motivoBloqueio(aluno) {
  if (!aluno.ativo) return 'Inativo';
  if (!aluno.tem_foto) return 'Sem foto';
  if (!matriculaServeDeId(aluno.matricula)) return 'Matrícula fora do padrão';
  return null;
}

/**
 * "Enviar e receber dados" (rota /dispositivos/sincronizar).
 *
 * Escolhe-se a acao, a unidade do ambiente (empresa ou escola) e o equipamento
 * dela. Enviar: a foto GUARDADA de cada aluno marcado vai ao equipamento - a
 * foto se cadastra na tela de editar aluno. Receber: marcacoes e usuarios do
 * equipamento, as mesmas acoes da tela do dispositivo.
 *
 * As unidades da lista sao as que tem equipamento. A lista de equipamentos ja
 * vem recortada pelo servidor: com uma unidade escolhida no topo, so aparece a
 * dela.
 */
export default function SincronizarDispositivos() {
  const { empresaSelecionada } = useAuth();
  const [acao, setAcao] = useState('enviar');
  const [dispositivos, setDispositivos] = useState(null); // null = carregando
  const [unidades, setUnidades] = useState([]);
  const [alunos, setAlunos] = useState(null);
  const [unidadeId, setUnidadeId] = useState('');
  const [dispositivoId, setDispositivoId] = useState('');
  const [filtros, setFiltros] = useState({ busca: '', turma: '', situacao: 'ativos', foto: '' });
  const [marcados, setMarcados] = useState(() => new Set());
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const [status, setStatus] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [usuariosEquipamento, setUsuariosEquipamento] = useState(null);

  useEffect(() => {
    let ativo = true;
    Promise.allSettled([api.listarDispositivos(), api.listarUnidades(), api.listarAlunos()]).then(([d, u, a]) => {
      if (!ativo) return;
      if (d.status === 'fulfilled') setDispositivos(d.value.dispositivos || []);
      else {
        setDispositivos([]);
        setErro('Não foi possível carregar os equipamentos.');
      }
      // Sem permissao para listar unidades, a lista ainda funciona - so sem o nome delas.
      if (u.status === 'fulfilled') setUnidades(u.value.filiais || u.value.unidades || []);
      setAlunos(a.status === 'fulfilled' ? a.value.alunos || [] : []);
    });
    return () => { ativo = false; };
  }, []);

  const opcoesUnidade = useMemo(() => {
    const ids = [...new Set((dispositivos || []).map((d) => d.filial_id).filter(Boolean))];
    return ids
      .map((id) => {
        const u = unidades.find((x) => x.id === id);
        return {
          valor: id,
          rotulo: u ? `${u.nome} · ${u.tipo === 'escola' ? 'Escola' : 'Empresa'}` : 'Unidade',
        };
      })
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo));
  }, [dispositivos, unidades]);

  const unidade = unidades.find((u) => u.id === unidadeId);
  const equipamentosDaUnidade = (dispositivos || []).filter((d) => d.filial_id === unidadeId);
  const dispositivo = equipamentosDaUnidade.find((d) => d.id === dispositivoId);
  const aceitaFace = dispositivo?.situacao === 'ativo' && dispositivo?.protocolo === 'evo_ws';

  const daUnidade = useMemo(
    () => (alunos || []).filter((a) => a.filial_id === unidadeId),
    [alunos, unidadeId],
  );
  const opcoesTurma = useMemo(() => {
    const turmas = new Map(daUnidade.filter((a) => a.turma_id).map((a) => [a.turma_id, a.turma_nome || 'Turma']));
    return [
      { valor: '', rotulo: 'Todas as turmas' },
      ...[...turmas].map(([valor, rotulo]) => ({ valor, rotulo })).sort((a, b) => a.rotulo.localeCompare(b.rotulo)),
      { valor: 'sem', rotulo: 'Sem turma' },
    ];
  }, [daUnidade]);

  const termo = filtros.busca.trim().toLowerCase();
  const visiveis = daUnidade.filter((a) =>
    (!termo || a.nome.toLowerCase().includes(termo) || String(a.matricula || '').toLowerCase().includes(termo))
    && (!filtros.turma || (filtros.turma === 'sem' ? !a.turma_id : a.turma_id === filtros.turma))
    && (filtros.situacao === 'todos' || (filtros.situacao === 'ativos' ? a.ativo : !a.ativo))
    && (!filtros.foto || (filtros.foto === 'com' ? a.tem_foto : !a.tem_foto)));
  const enviaveis = visiveis.filter((a) => !motivoBloqueio(a));
  const nomePorId = new Map((alunos || []).map((a) => [a.id, a.nome]));

  const filtrar = (campo) => (valor) => setFiltros((f) => ({ ...f, [campo]: valor }));

  // Trocar acao, unidade ou equipamento comeca de novo: marcacoes e resultados
  // de um equipamento nao valem para outro.
  function recomecar() {
    setMarcados(new Set());
    setResultados(null);
    setUsuariosEquipamento(null);
    setStatus(null);
    setErro(null);
  }

  function alternar(alunoId) {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(alunoId)) proximo.delete(alunoId);
      else proximo.add(alunoId);
      return proximo;
    });
  }

  async function enviar() {
    const ids = [...marcados];
    const todos = [];
    setOcupado(true);
    setErro(null);
    setResultados(null);
    try {
      for (let i = 0; i < ids.length; i += LOTE) {
        setStatus(`Enviando ${Math.min(i + LOTE, ids.length)} de ${ids.length} aluno(s)...`);
        const resposta = await api.enviarAlunosAoEquipamento(dispositivoId, ids.slice(i, i + LOTE));
        todos.push(...(resposta.resultados || []));
      }
      const conta = (estado) => todos.filter((r) => r.estado === estado).length;
      setStatus(`${conta('enviado')} enviado(s), ${conta('pendente')} na fila do equipamento, ${conta('erro')} não enviado(s).`);
      setMarcados(new Set());
    } catch (err) {
      setStatus(null);
      setErro(err.message || 'Não foi possível enviar ao equipamento.');
    } finally {
      if (todos.length) setResultados(todos);
      setOcupado(false);
    }
  }

  async function receberMarcacoes() {
    setOcupado(true);
    setErro(null);
    setStatus('Recebendo marcações...');
    try {
      const r = await api.forcarColeta(dispositivoId);
      if (r.ok === false) throw new Error(r.erro);
      setStatus(`${r.totalNovos} marcação(ões) nova(s), ${r.totalNaoResolvidos} sem vínculo.`);
    } catch (err) {
      setStatus(null);
      setErro(`Não foi possível receber as marcações: ${err.message}`);
    } finally {
      setOcupado(false);
    }
  }

  async function receberUsuarios() {
    setOcupado(true);
    setErro(null);
    setStatus('Consultando o equipamento...');
    try {
      const r = await api.usuariosNoEquipamento(dispositivoId);
      if (r.ok === false) throw new Error(r.erro);
      setUsuariosEquipamento(r.usuarios || []);
      setStatus(`${(r.usuarios || []).length} usuário(s) recebido(s) do equipamento.`);
    } catch (err) {
      setStatus(null);
      setErro(`Não foi possível receber os usuários: ${err.message}`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Layout>
      <Link to="/dispositivos" className="link-topo">&larr; Dispositivos</Link>
      <h1 className="titulo-pagina">Enviar e receber dados</h1>
      <p className="subtitulo-pagina">
        Ambiente: <strong>{empresaSelecionada?.nome || '—'}</strong>. Escolha o que fazer, a unidade e o equipamento.
      </p>

      {erro && <div className="erro">{erro}</div>}
      {status && <div className="info" role="status">{status}</div>}

      <div className="card">
        <div className="eyebrow">Equipamento</div>
        <div className="card-corpo">
          <div className="alternar-visao" role="group" aria-label="O que fazer" style={{ marginLeft: 0, marginBottom: 16 }}>
            <button type="button" aria-pressed={acao === 'enviar'} onClick={() => { setAcao('enviar'); recomecar(); }}>
              Enviar ao equipamento
            </button>
            <button type="button" aria-pressed={acao === 'receber'} onClick={() => { setAcao('receber'); recomecar(); }}>
              Receber do equipamento
            </button>
          </div>

          {dispositivos === null ? (
            <p className="texto-apoio">Carregando equipamentos...</p>
          ) : opcoesUnidade.length === 0 ? (
            <div className="vazio">Nenhum equipamento cadastrado neste ambiente.</div>
          ) : (
            <div className="grid-form">
              <div className="campo">
                <label htmlFor="sinc-unidade">Unidade</label>
                <Selecao
                  id="sinc-unidade"
                  rotuloAria="Unidade"
                  valor={unidadeId}
                  aoMudar={(v) => { setUnidadeId(v); setDispositivoId(''); recomecar(); }}
                  vazio="Selecione a unidade"
                  opcoes={opcoesUnidade}
                />
              </div>
              <div className="campo">
                <label htmlFor="sinc-equipamento">Equipamento</label>
                <Selecao
                  id="sinc-equipamento"
                  rotuloAria="Equipamento"
                  valor={dispositivoId}
                  aoMudar={(v) => { setDispositivoId(v); recomecar(); }}
                  vazio={unidadeId ? 'Selecione o equipamento' : 'Escolha a unidade primeiro'}
                  desabilitado={!unidadeId}
                  opcoes={equipamentosDaUnidade.map((d) => ({
                    valor: d.id,
                    rotulo: `${d.descricao || d.numero_serie}${d.situacao === 'ativo' ? '' : ' (inativo)'}`,
                  }))}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {dispositivo && acao === 'enviar' && (
        <div className="card">
          <div className="eyebrow">Alunos para enviar</div>
          <div className="card-corpo">
            {!aceitaFace ? (
              <div className="aviso">
                Este equipamento não recebe cadastro de rosto pelo sistema: ele precisa estar
                ativo e ser do tipo Evo conectado por WebSocket.
              </div>
            ) : unidade && unidade.tipo !== 'escola' ? (
              <div className="aviso">Esta unidade é do tipo empresa: alunos só existem em unidade do tipo escola.</div>
            ) : alunos === null ? (
              <p className="texto-apoio">Carregando alunos...</p>
            ) : (
              <>
                <p className="texto-apoio" style={{ marginTop: 0 }}>
                  Vai a foto guardada de cada aluno marcado. A foto se cadastra na tela de editar aluno.
                  Quem está sem foto, inativo ou com a matrícula fora do padrão (só números, sem zero à
                  esquerda) não pode ser marcado.
                </p>

                <div className="filtros">
                  <div className="campo cresce">
                    <label htmlFor="sinc-busca">Buscar</label>
                    <input
                      id="sinc-busca"
                      value={filtros.busca}
                      onChange={(e) => filtrar('busca')(e.target.value)}
                      placeholder="Nome ou matrícula"
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="sinc-turma">Turma</label>
                    <Selecao id="sinc-turma" rotuloAria="Turma" valor={filtros.turma} aoMudar={filtrar('turma')} opcoes={opcoesTurma} />
                  </div>
                  <div className="campo">
                    <label htmlFor="sinc-situacao">Situação</label>
                    <Selecao
                      id="sinc-situacao"
                      rotuloAria="Situação"
                      valor={filtros.situacao}
                      aoMudar={filtrar('situacao')}
                      opcoes={[
                        { valor: 'ativos', rotulo: 'Ativos' },
                        { valor: 'inativos', rotulo: 'Inativos' },
                        { valor: 'todos', rotulo: 'Todos' },
                      ]}
                    />
                  </div>
                  <div className="campo">
                    <label htmlFor="sinc-foto">Foto</label>
                    <Selecao
                      id="sinc-foto"
                      rotuloAria="Foto"
                      valor={filtros.foto}
                      aoMudar={filtrar('foto')}
                      opcoes={[
                        { valor: '', rotulo: 'Com e sem foto' },
                        { valor: 'com', rotulo: 'Com foto' },
                        { valor: 'sem', rotulo: 'Sem foto' },
                      ]}
                    />
                  </div>
                </div>

                <div className="acoes-form" style={{ justifyContent: 'flex-start', marginTop: 0, marginBottom: 12 }}>
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => setMarcados((atual) => new Set([...atual, ...enviaveis.map((a) => a.id)]))}
                    disabled={!enviaveis.length || ocupado}
                  >
                    Marcar todos os filtrados ({enviaveis.length})
                  </button>
                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={() => setMarcados(new Set())}
                    disabled={!marcados.size || ocupado}
                  >
                    Desmarcar todos
                  </button>
                  <button
                    type="button"
                    className="btn btn-primario"
                    onClick={enviar}
                    disabled={!marcados.size || ocupado}
                  >
                    {ocupado ? 'Enviando...' : `Enviar ${marcados.size} aluno(s) ao equipamento`}
                  </button>
                </div>

                <table className="tabela">
                  <thead>
                    <tr><th style={{ width: 1 }}><span className="sr-only">Marcar</span></th><th>Nome</th><th>Matrícula</th><th>Turma</th><th>Envio</th></tr>
                  </thead>
                  <tbody>
                    {visiveis.map((a) => {
                      const motivo = motivoBloqueio(a);
                      return (
                        <tr key={a.id}>
                          <td>
                            <label className="marcar">
                              <input
                                type="checkbox"
                                checked={marcados.has(a.id)}
                                disabled={Boolean(motivo) || ocupado}
                                onChange={() => alternar(a.id)}
                                aria-label={`Marcar ${a.nome}`}
                              />
                            </label>
                          </td>
                          <td>{a.nome}</td>
                          <td className="mono">{a.matricula || '—'}</td>
                          <td>{a.turma_nome || 'Sem turma'}</td>
                          <td>
                            {motivo
                              ? <span className="badge badge-atencao">{motivo}</span>
                              : <span className="badge badge-ok">Pode enviar</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {visiveis.length === 0 && (
                      <tr><td colSpan={5}><div className="vazio">Nenhum aluno com esses filtros.</div></td></tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      {resultados && (
        <div className="card">
          <div className="eyebrow">Resultado do envio</div>
          <div className="card-corpo">
            <table className="tabela">
              <thead><tr><th>Aluno</th><th>Resultado</th><th>Detalhe</th></tr></thead>
              <tbody>
                {resultados.map((r) => (
                  <tr key={r.aluno_id}>
                    <td>{nomePorId.get(r.aluno_id) || r.aluno_id}</td>
                    <td><span className={`badge ${RESULTADO[r.estado]?.classe || 'badge-neutro'}`}>{RESULTADO[r.estado]?.rotulo || r.estado}</span></td>
                    <td>{r.mensagem || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dispositivo && acao === 'receber' && (
        <div className="card">
          <div className="eyebrow">Receber do equipamento</div>
          <div className="card-corpo">
            <div className="acoes-form" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
              <button type="button" className="btn btn-secundario" onClick={receberMarcacoes} disabled={ocupado}>
                Receber marcações
              </button>
              {dispositivo.protocolo === 'evo_ws' && (
                <button type="button" className="btn btn-secundario" onClick={receberUsuarios} disabled={ocupado}>
                  Receber usuários
                </button>
              )}
            </div>
            {usuariosEquipamento && (
              <div style={{ marginTop: 16 }}>
                <UsuariosDoEquipamento usuarios={usuariosEquipamento} />
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
