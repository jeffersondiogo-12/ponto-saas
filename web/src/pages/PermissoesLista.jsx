import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { PAPEIS, rotuloPapel } from '../utils/dominio';
import { ACOES, ROTULO_ACAO, rotuloRecurso } from '../utils/permissoes';

/**
 * Administracao da matriz de permissoes. So super_admin — o backend restringe
 * as cinco rotas de /api/permissoes/* a esse papel.
 *
 * Duas camadas, e a ordem de precedencia e o que a tela precisa deixar claro:
 *
 *   REGRA DO CARGO   vale para todos daquele papel
 *   EXCECAO PESSOAL  sobrepoe a regra, para uma pessoa so
 *
 * O servidor consulta a excecao primeiro (`middlewares/permissions.js`): se
 * existir, ela decide sozinha, liberando ou negando. Por isso a aba "Por
 * pessoa" mostra a ORIGEM de cada linha — sem isso, ninguem entende por que
 * dois gestores tem acessos diferentes.
 */

const ABAS = [
  { valor: 'cargo', rotulo: 'Por cargo' },
  { valor: 'pessoa', rotulo: 'Por pessoa' },
];

export default function PermissoesLista() {
  const { usuario } = useAuth();
  const ehSuperAdmin = usuario?.papel === 'super_admin';

  const [aba, setAba] = useState('cargo');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(null); // "recurso:acao" em gravacao

  // --- aba por cargo ---
  const [matriz, setMatriz] = useState([]);
  const [alcance, setAlcance] = useState([]);
  const [papel, setPapel] = useState('admin');

  // --- aba por pessoa ---
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioId, setUsuarioId] = useState('');
  const [efetivo, setEfetivo] = useState([]);

  const carregarMatriz = useCallback(async () => {
    try {
      const r = await api.listarMatrizPapeis();
      setMatriz(r.permissoes || []);
      setAlcance(r.alcance || []);
      setErro(null);
    } catch (err) {
      setErro(err.status === 403
        ? 'Só o super admin administra permissões.'
        : err.message || 'Não foi possível carregar a matriz.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!ehSuperAdmin) { setCarregando(false); return; }
    carregarMatriz();
    api.listarUsuarios()
      .then((r) => setUsuarios(r.usuarios || []))
      .catch(() => setUsuarios([]));
  }, [ehSuperAdmin, carregarMatriz]);

  const carregarEfetivo = useCallback(async (id) => {
    if (!id) { setEfetivo([]); return; }
    try {
      const r = await api.listarPermissoesDoUsuario(id);
      setEfetivo(r.permissoes || []);
      setErro(null);
    } catch (err) {
      setEfetivo([]);
      setErro(err.message || 'Não foi possível carregar as permissões desta pessoa.');
    }
  }, []);

  useEffect(() => { carregarEfetivo(usuarioId); }, [usuarioId, carregarEfetivo]);

  /**
   * A lista de recursos vem do CATALOGO (`alcance`), nao das linhas da matriz.
   *
   * Empresa nova nasce com a matriz vazia de proposito — o super admin cadastra
   * as pessoas e concede o acesso de cada uma. Se a tela tirasse os recursos das
   * linhas existentes, uma empresa nova abriria sem nenhuma linha e nao haveria
   * o que marcar: a tela ficaria inutil justamente no momento em que ela e mais
   * necessaria.
   *
   * O catalogo tambem diz quais cargos ALCANCAM cada recurso, que e a regra de
   * rota (`exigirPapel`) — coisa que as linhas da matriz nunca revelariam.
   */
  const recursos = useMemo(
    () => alcance.map((a) => a.recurso),
    [alcance],
  );

  /** O cargo consegue chegar neste recurso? Fora disso, gravar retorna 400. */
  const alcancaRecurso = useMemo(() => {
    const mapa = new Map(alcance.map((a) => [a.recurso, a.papeisPermitidos || []]));
    return (recurso, papelAlvo) => {
      const permitidos = mapa.get(recurso);
      return !permitidos || permitidos.includes(papelAlvo);
    };
  }, [alcance]);

  /**
   * Estado atual de uma celula na aba de cargo.
   *
   * So as linhas GERAIS da empresa entram: desde que a matriz ganhou escopo,
   * a mesma combinacao cargo+recurso+acao pode ter uma linha geral, uma por
   * filial e uma por atribuicao de professor. Esta tela edita a geral — e o
   * que ela grava, sem `filial_id` no corpo. Misturar as outras aqui mostraria
   * o valor de um escopo especifico na caixa que altera o padrao.
   */
  const permitidoNoCargo = useMemo(() => {
    const mapa = new Map();
    for (const l of matriz) {
      if (l.filial_id || l.atribuicao_id) continue;
      mapa.set(`${l.papel}:${l.recurso}:${l.acao}`, l.permitido);
    }
    return (recurso, acao) => mapa.get(`${papel}:${recurso}:${acao}`) === true;
  }, [matriz, papel]);

  /** Existe regra por filial ou por atribuicao que esta tela nao mostra? */
  const temEscopoEspecifico = useMemo(
    () => matriz.some((l) => l.filial_id || l.atribuicao_id),
    [matriz],
  );

  /** Estado atual de uma celula na aba de pessoa, com a origem. */
  const linhaDaPessoa = useMemo(() => {
    const mapa = new Map();
    for (const l of efetivo) mapa.set(`${l.recurso}:${l.acao}`, l);
    return (recurso, acao) => mapa.get(`${recurso}:${acao}`) || null;
  }, [efetivo]);

  async function alternarCargo(recurso, acao) {
    const chave = `${recurso}:${acao}`;
    setSalvando(chave); setErro(null); setAviso(null);
    try {
      const novo = !permitidoNoCargo(recurso, acao);
      await api.definirPermissaoPapel(papel, { recurso, acao, permitido: novo });
      setAviso(`${rotuloPapel(papel)} ${novo ? 'agora pode' : 'não pode mais'} ${ROTULO_ACAO[acao].toLowerCase()} em ${rotuloRecurso(recurso)}.`);
      await carregarMatriz();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(null);
    }
  }

  async function definirExcecao(recurso, acao, permitido) {
    const chave = `${recurso}:${acao}`;
    setSalvando(chave); setErro(null); setAviso(null);
    try {
      await api.definirOverrideUsuario(usuarioId, { recurso, acao, permitido });
      setAviso('Exceção pessoal gravada. Ela vale acima da regra do cargo.');
      await carregarEfetivo(usuarioId);
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar a exceção.');
    } finally {
      setSalvando(null);
    }
  }

  async function voltarAoCargo(recurso, acao) {
    const chave = `${recurso}:${acao}`;
    setSalvando(chave); setErro(null); setAviso(null);
    try {
      await api.removerOverrideUsuario(usuarioId, { recurso, acao });
      setAviso('Exceção removida. A pessoa voltou a seguir a regra do cargo.');
      await carregarEfetivo(usuarioId);
    } catch (err) {
      setErro(err.message || 'Não foi possível remover a exceção.');
    } finally {
      setSalvando(null);
    }
  }

  if (!ehSuperAdmin) {
    return (
      <Layout>
        <h1 className="titulo-pagina">Permissões</h1>
        <div className="card"><div className="card-corpo">
          <div className="vazio">Só o super admin administra permissões.</div>
        </div></div>
      </Layout>
    );
  }

  if (carregando) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;

  const pessoa = usuarios.find((u) => u.id === usuarioId);

  return (
    <Layout>
      <h1 className="titulo-pagina">Permissões</h1>
      <p className="subtitulo-pagina">
        O que cada cargo alcança no sistema, e as exceções abertas para pessoas
        específicas. Muda aqui, vale na hora — não precisa de nova versão.
      </p>

      {erro && <div className="erro">{erro}</div>}
      {aviso && <div className="sucesso">{aviso}</div>}

      <div className="filtros">
        <div className="campo">
          <label htmlFor="pm-aba">Ver</label>
          <Selecao id="pm-aba" rotuloAria="Modo de visualização" valor={aba} aoMudar={setAba} opcoes={ABAS} />
        </div>
        {aba === 'cargo' ? (
          <div className="campo">
            <label htmlFor="pm-papel">Cargo</label>
            <Selecao
              id="pm-papel" rotuloAria="Cargo" valor={papel} aoMudar={setPapel}
              opcoes={PAPEIS.filter((p) => p.valor !== 'super_admin')}
            />
          </div>
        ) : (
          <div className="campo cresce">
            <label htmlFor="pm-pessoa">Pessoa</label>
            <Selecao
              id="pm-pessoa" rotuloAria="Pessoa" valor={usuarioId} aoMudar={setUsuarioId}
              vazio="Escolha quem receberá a exceção"
              opcoes={usuarios
                .filter((u) => u.papel !== 'super_admin')
                .map((u) => ({ valor: u.id, rotulo: `${u.nome} · ${rotuloPapel(u.papel)}` }))}
            />
          </div>
        )}
      </div>

      <p className="info">
        {aba === 'cargo'
          ? <>O <strong>super admin</strong> não aparece aqui: ele passa por todas as verificações antes de a matriz ser consultada, então marcar ou desmarcar não teria efeito.</>
          : <>A exceção pessoal <strong>vence a regra do cargo</strong>, nos dois sentidos — libera quem o cargo bloqueia, e bloqueia quem o cargo libera.</>}
      </p>

      <div className="card">
        <div className="card-corpo">
          {recursos.length === 0 ? (
            /* Isto agora e falha de carga de verdade: o catalogo de recursos
               nao depende de haver permissao gravada, entao vazio aqui so
               acontece se a API nao respondeu. Sem este estado, a tela
               mostraria so o cabecalho e pareceria quebrada. */
            <div className="vazio">
              A API não devolveu a lista de recursos. Recarregue a página; se
              continuar, o servidor está fora do ar.
            </div>
          ) : aba === 'pessoa' && !usuarioId ? (
            <div className="vazio">Escolha uma pessoa para ver e ajustar as permissões dela.</div>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Recurso</th>
                  {ACOES.map((a) => <th key={a} style={{ textAlign: 'center' }}>{ROTULO_ACAO[a]}</th>)}
                </tr>
              </thead>
              <tbody>
                {recursos.map((recurso) => (
                  <tr key={recurso}>
                    <td><strong>{rotuloRecurso(recurso)}</strong></td>
                    {ACOES.map((acao) => {
                      const chave = `${recurso}:${acao}`;
                      const gravando = salvando === chave;

                      if (aba === 'cargo') {
                        /* Fora do alcance a rota barra pelo cargo antes de
                           olhar a matriz: marcar aqui devolveria 400 e, se
                           gravasse, seria uma permissao que nunca vale. */
                        const alcanca = alcancaRecurso(recurso, papel);
                        return (
                          <td key={acao} style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              aria-label={`${ROTULO_ACAO[acao]} em ${rotuloRecurso(recurso)} para ${rotuloPapel(papel)}`}
                              checked={alcanca && permitidoNoCargo(recurso, acao)}
                              disabled={gravando || !alcanca}
                              title={alcanca ? undefined : `${rotuloPapel(papel)} não tem acesso a ${rotuloRecurso(recurso)}.`}
                              onChange={() => alternarCargo(recurso, acao)}
                            />
                          </td>
                        );
                      }

                      const linha = linhaDaPessoa(recurso, acao);
                      const pessoal = linha?.origem === 'pessoal';
                      const permitido = linha?.permitido === true;
                      /* Mesma trava da aba de cargo: a excecao pessoal nao
                         vence a porta de papel da rota. O servidor recusa com
                         400, e o documento do backend e explicito nisso. */
                      const alcanca = pessoa ? alcancaRecurso(recurso, pessoa.papel) : true;
                      return (
                        <td key={acao} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            aria-label={`${ROTULO_ACAO[acao]} em ${rotuloRecurso(recurso)} para ${pessoa?.nome || 'esta pessoa'}`}
                            checked={alcanca && permitido}
                            disabled={gravando || !alcanca}
                            title={alcanca ? undefined : `${rotuloPapel(pessoa.papel)} não tem acesso a ${rotuloRecurso(recurso)}.`}
                            onChange={() => definirExcecao(recurso, acao, !permitido)}
                          />
                          {pessoal && (
                            <div style={{ marginTop: 3 }}>
                              <button
                                type="button"
                                className="btn-vinculo"
                                disabled={gravando}
                                onClick={() => voltarAoCargo(recurso, acao)}
                                title="Remover a exceção e voltar a seguir a regra do cargo"
                              >
                                exceção
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {aba === 'pessoa' && usuarioId && (
        <p className="texto-apoio" style={{ marginTop: 10 }}>
          Onde aparece <strong>exceção</strong>, aquela permissão foi decidida para
          esta pessoa e não segue mais o cargo. Clique para desfazer.
        </p>
      )}

      {aba === 'cargo' && temEscopoEspecifico && (
        /* A matriz ganhou escopo por filial e por atribuicao de professor.
           Esta tela edita so o padrao da empresa — sem esse aviso, alguem
           desmarca aqui, ve a pessoa continuar com acesso e acha que a tela
           nao gravou. */
        <p className="texto-apoio" style={{ marginTop: 10 }}>
          Esta empresa tem regras específicas por unidade ou por turma que não
          aparecem nesta tabela. O que você marca aqui é o <strong>padrão da
          empresa</strong>; onde existir regra específica, ela vale acima deste
          padrão.
        </p>
      )}
    </Layout>
  );
}
