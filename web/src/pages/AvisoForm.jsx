import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

/**
 * O backend aceita `alvos: [{ filial_id, turma_id }]`. Lista vazia = empresa
 * inteira. Como cada linha carrega ou uma filial ou uma turma (nunca as duas —
 * `validarAlvos` recusa), a tela pergunta primeiro o TIPO de alcance e depois
 * quais itens, em vez de mostrar duas listas que se anulam.
 *
 * O gestor nao ve a opcao de empresa nem a de unidades: `validarAlvo` no
 * servidor forca a filial dele e recusa 403 em qualquer outra, entao oferecer
 * seria prometer erro.
 */
const ALCANCES = {
  empresa: { valor: 'empresa', rotulo: 'Empresa inteira' },
  unidades: { valor: 'unidades', rotulo: 'Unidades específicas' },
  turmas: { valor: 'turmas', rotulo: 'Turmas específicas' },
};

const paraInputLocal = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function AvisoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editando = Boolean(id);
  const { usuario, filialSelecionada } = useAuth();
  const ehGestor = usuario?.papel === 'gestor';

  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  /**
   * Dois modos, em vez de um campo de data ja preenchido com "agora".
   *
   * O `datetime-local` tem precisao de MINUTO: as 14:30:45 ele devolve
   * 14:30:00, ou seja 45 segundos no passado — e o backend recusa qualquer
   * data anterior a `agora - 5s` com 400. Quem so queria enviar na hora era
   * obrigado a empurrar para o minuto seguinte, sem entender por que.
   *
   * Com "Enviar agora" a tela nao manda `publicado_em` nenhum, e o servidor
   * usa o proprio relogio. O campo de data so aparece quando ha o que agendar.
   */
  const [modo, setModo] = useState('agora');
  const [quando, setQuando] = useState(paraInputLocal());
  const [alcance, setAlcance] = useState(ehGestor ? 'turmas' : 'empresa');
  const [selecionados, setSelecionados] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const opcoesAlcance = useMemo(
    () => (ehGestor ? [ALCANCES.turmas] : [ALCANCES.empresa, ALCANCES.unidades, ALCANCES.turmas]),
    [ehGestor],
  );

  useEffect(() => {
    let ativo = true;
    (async () => {
      const [unid, turm, av] = await Promise.allSettled([
        api.listarUnidades(),
        api.listarTurmas(),
        id ? api.buscarAviso(id) : Promise.resolve(null),
      ]);
      if (!ativo) return;

      if (unid.status === 'fulfilled') setUnidades((unid.value.filiais || []).filter((f) => f.ativo));
      if (turm.status === 'fulfilled') setTurmas((turm.value.turmas || []).filter((t) => t.ativo));

      if (av.status === 'fulfilled' && av.value?.aviso) {
        const a = av.value.aviso;
        setTitulo(a.titulo || '');
        setMensagem(a.mensagem || '');
        setQuando(paraInputLocal(a.publicado_em));
        // Aviso ja agendado abre em "agendar", com a data dele; um que sairia
        // agora nao tem o que reagendar.
        setModo(new Date(a.publicado_em).getTime() > Date.now() ? 'agendar' : 'agora');
        const alvos = a.alvos || [];
        if (!alvos.length) setAlcance('empresa');
        else if (alvos.every((x) => x.turma_id)) {
          setAlcance('turmas');
          setSelecionados(alvos.map((x) => x.turma_id));
        } else {
          setAlcance('unidades');
          setSelecionados(alvos.map((x) => x.filial_id).filter(Boolean));
        }
      } else if (av.status === 'rejected') {
        setErro(av.reason?.message || 'Não foi possível carregar o aviso.');
      }
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [id]);

  // O gestor so enxerga turmas da propria unidade — o servidor recusa as outras.
  const turmasVisiveis = useMemo(
    () => (ehGestor && filialSelecionada ? turmas.filter((t) => t.filial_id === filialSelecionada.id) : turmas),
    [turmas, ehGestor, filialSelecionada],
  );

  const itens = alcance === 'unidades' ? unidades : alcance === 'turmas' ? turmasVisiveis : [];

  function alternar(itemId) {
    setSelecionados((atuais) =>
      atuais.includes(itemId) ? atuais.filter((x) => x !== itemId) : [...atuais, itemId]);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro(null);

    if (!titulo.trim()) { setErro('Escreva o título do aviso.'); return; }
    if (!mensagem.trim()) { setErro('Escreva a mensagem do aviso.'); return; }
    // Avisa aqui em vez de deixar o servidor recusar com 400 depois do envio.
    if (modo === 'agendar' && new Date(quando).getTime() <= Date.now()) {
      setErro('A data de envio precisa ser no futuro. Para enviar imediatamente, escolha “Enviar agora”.');
      return;
    }
    // <Selecao> e um <button> e nao participa da validacao nativa do formulario.
    if (alcance !== 'empresa' && selecionados.length === 0) {
      setErro(alcance === 'turmas' ? 'Escolha ao menos uma turma.' : 'Escolha ao menos uma unidade.');
      return;
    }

    const alvos = alcance === 'empresa'
      ? []
      : selecionados.map((itemId) => (alcance === 'turmas'
        ? { turma_id: itemId, filial_id: null }
        : { filial_id: itemId, turma_id: null }));

    setSalvando(true);
    try {
      const corpo = {
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        // Sem `publicado_em`, o backend usa `new Date()` — e nao ha janela para
        // o relogio do navegador ficar para tras do dele.
        ...(modo === 'agendar' ? { publicado_em: new Date(quando).toISOString() } : {}),
        alvos,
      };
      if (editando) await api.atualizarAviso(id, corpo);
      else await api.criarAviso(corpo);
      navigate('/avisos');
    } catch (err) {
      // 409 aqui só acontece se o aviso saiu entre a abertura da tela e o envio.
      setErro(err.status === 409
        ? 'Este aviso já foi enviado enquanto você editava, e por isso não pode mais ser alterado.'
        : err.message || 'Não foi possível salvar o aviso.');
      setSalvando(false);
    }
  }

  if (carregando) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;

  return (
    <Layout>
      <Link to="/avisos" className="link-topo">&larr; Avisos</Link>
      <h1 className="titulo-pagina">{editando ? 'Editar aviso' : 'Criar aviso'}</h1>
      <p className="subtitulo-pagina">
        O aviso sai na data marcada e chega como notificação no aplicativo dos
        responsáveis. Depois de enviado, o texto não pode mais ser alterado.
      </p>

      {erro && <div className="erro">{erro}</div>}

      <form onSubmit={enviar}>
        <div className="card">
          <div className="card-corpo">
            <div className="campo">
              <label htmlFor="av-titulo">Título <span className="obrigatorio">*</span></label>
              <input
                id="av-titulo"
                className="entrada"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={150}
                placeholder="Reunião de pais"
              />
            </div>

            <div className="campo" style={{ marginTop: 14 }}>
              <label htmlFor="av-mensagem">Mensagem <span className="obrigatorio">*</span></label>
              <textarea
                id="av-mensagem"
                rows={4}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="O responsável vê este texto na notificação e no mural."
              />
            </div>

            <div className="campo" style={{ marginTop: 14 }}>
              <label htmlFor="av-modo">Quando enviar <span className="obrigatorio">*</span></label>
              <Selecao
                id="av-modo"
                rotuloAria="Quando enviar"
                valor={modo}
                aoMudar={setModo}
                opcoes={[
                  { valor: 'agora', rotulo: 'Enviar agora' },
                  { valor: 'agendar', rotulo: 'Agendar para uma data' },
                ]}
              />
              {modo === 'agora' && (
                <span className="ajuda">
                  O aviso sai assim que você salvar, e a notificação chega no
                  aplicativo dos responsáveis.
                </span>
              )}
            </div>

            {modo === 'agendar' && (
              <div className="campo" style={{ marginTop: 14 }}>
                <label htmlFor="av-quando">Data e hora do envio</label>
                <input
                  id="av-quando"
                  className="entrada mono"
                  type="datetime-local"
                  value={quando}
                  onChange={(e) => setQuando(e.target.value)}
                  style={{ width: 240 }}
                />
                <span className="ajuda">
                  Até chegar essa hora, o aviso fica como “Aguardando data” e
                  pode ser editado ou excluído.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-corpo">
            <div className="campo">
              <label htmlFor="av-alcance">Para quem <span className="obrigatorio">*</span></label>
              <Selecao
                id="av-alcance"
                rotuloAria="Alcance do aviso"
                valor={alcance}
                aoMudar={(v) => { setAlcance(v); setSelecionados([]); }}
                opcoes={opcoesAlcance}
              />
              {ehGestor && (
                <span className="ajuda">
                  Como gestor, você envia para turmas da sua unidade.
                </span>
              )}
            </div>

            {alcance === 'empresa' ? (
              <p className="info" style={{ marginTop: 14 }}>
                O aviso chega a <strong>todos os responsáveis da empresa</strong>,
                em todas as unidades.
              </p>
            ) : (
              <div style={{ marginTop: 14 }}>
                <label>{alcance === 'turmas' ? 'Turmas' : 'Unidades'}</label>
                {itens.length === 0 ? (
                  <div className="vazio">
                    {alcance === 'turmas' ? 'Nenhuma turma ativa disponível.' : 'Nenhuma unidade ativa disponível.'}
                  </div>
                ) : (
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th style={{ width: 1 }}>Enviar</th>
                        <th>Nome</th>
                        {alcance === 'turmas' && <th>Unidade</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Enviar para ${item.nome}`}
                              checked={selecionados.includes(item.id)}
                              onChange={() => alternar(item.id)}
                            />
                          </td>
                          <td>{item.nome}</td>
                          {alcance === 'turmas' && <td>{item.filial_nome || '—'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="acoes-form">
          <Link to="/avisos" className="btn btn-secundario">Cancelar</Link>
          <button type="submit" className="btn btn-primario" disabled={salvando}>
            {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar aviso'}
          </button>
        </div>
      </form>
    </Layout>
  );
}
