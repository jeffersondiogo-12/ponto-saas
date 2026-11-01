import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Icone from '../app/Icone';
import { useRecarregarAoVivo } from '../context/RealtimeContext';
import ResponsavelResumo from './ResponsavelResumo';

const dataHora = (v) => (v
  ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '');

/**
 * Sino dos pedidos de vinculacao feitos pelo app (o "Adicionar filho" virou
 * pedido em 2026-10-31). Mostra quem pediu, os contatos e o aluno da
 * matricula. "Abrir aluno" leva a edicao com a tela "Acesso do responsável"
 * aberta, SEM preencher nem selecionar ninguem: quem trata fala com o
 * responsavel antes de ligar (decisao do Samuel). Aprovar nao existe aqui: o
 * vinculo e feito na tela de acesso, e ligar ali fecha o pedido pendente
 * daquela pessoa para aquele aluno (backend `4f78c4e`), que sai do sino pelo
 * evento `responsavel.vinculo.decidido`. Recusar pede um segundo clique.
 *
 * Sem permissao ou com falha, o sino nao aparece: e atalho, nao trava a tela.
 */
export default function PedidosVinculo() {
  const navigate = useNavigate();
  const caixa = useRef(null);
  const [pedidos, setPedidos] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [recusando, setRecusando] = useState(null);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const resposta = await api.listarPedidosVinculo();
      setPedidos(resposta.notificacoes || []);
    } catch {
      setPedidos(null);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useRecarregarAoVivo(['responsavel.vinculo.solicitado', 'responsavel.vinculo.decidido'], carregar);
  useEffect(() => { if (aberto) caixa.current?.showModal(); }, [aberto]);

  async function recusar(pedido) {
    if (recusando !== pedido.id) { setRecusando(pedido.id); return; }
    setErro(null);
    try {
      await api.recusarPedidoVinculo(pedido.id);
      setRecusando(null);
      await carregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível recusar o pedido. Tente de novo.');
    }
  }

  if (pedidos === null) return null;
  const total = pedidos.length;
  const fechar = () => caixa.current?.close();

  return (
    <>
      <button
        type="button"
        className="btn btn-secundario sino"
        onClick={() => setAberto(true)}
        aria-label={`Pedidos de vinculação: ${total} pendente${total === 1 ? '' : 's'}`}
      >
        <Icone nome="notifications-outline" tamanho={18} />
        Pedidos de vinculação
        {total > 0 && <span className="badge badge-atencao">{total}</span>}
      </button>

      {aberto && (
        <dialog
          ref={caixa}
          className="modal ficha-aluno"
          aria-labelledby="pedidos-titulo"
          onClose={() => { setAberto(false); setRecusando(null); setErro(null); }}
          onClick={(e) => { if (e.target === caixa.current) fechar(); }}
        >
          <div className="ficha-miolo">
            <h2 id="pedidos-titulo">Pedidos de vinculação</h2>
            <p className="texto-apoio" style={{ marginTop: 0 }}>
              Responsáveis que pediram, pelo aplicativo, para acompanhar um aluno. Antes de vincular,
              fale com a pessoa pelo telefone ou e-mail e confirme.
            </p>
            {erro && <div className="erro">{erro}</div>}

            {!total ? (
              <p className="texto-apoio">Nenhum pedido pendente.</p>
            ) : (
              <ul className="responsaveis">
                {pedidos.map((p) => (
                  <ResponsavelResumo
                    key={p.id}
                    {...p.responsavel}
                    detalhe={(
                      <>
                        Pede para acompanhar <strong>{p.aluno.nome}</strong> · matrícula{' '}
                        <span className="mono">{p.aluno.matricula}</span> · {dataHora(p.criado_em)}
                      </>
                    )}
                    acoes={(
                      <>
                        <button type="button" className="btn btn-primario"
                          onClick={() => navigate(`/alunos/${p.aluno.id}/editar?acesso=1`)}>
                          Abrir aluno
                        </button>
                        <button type="button" className={`btn ${recusando === p.id ? 'btn-perigo' : 'btn-secundario'}`}
                          onClick={() => recusar(p)}>
                          {recusando === p.id ? 'Confirmar recusa' : 'Recusar'}
                        </button>
                      </>
                    )}
                  />
                ))}
              </ul>
            )}

            <div className="acoes-form">
              <button type="button" className="btn btn-secundario" onClick={fechar}>Fechar</button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
