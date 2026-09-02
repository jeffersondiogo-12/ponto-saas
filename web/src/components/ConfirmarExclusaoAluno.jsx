import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

/**
 * Confirmacao de exclusao PERMANENTE de aluno.
 *
 * `alunos.service.excluir` faz `.del()` direto, sem nenhuma trava — quem decide
 * o que acontece e o banco, e cada tabela reage de um jeito. Por isso esta tela
 * existe: as consequencias nao estao em lugar nenhum da interface, e duas delas
 * sao invisiveis depois do fato.
 *
 * O mapa real (migrations 20260719000022/23/25, 20260822000001/02 e
 * 20260826000012):
 *
 *   CASCADE  -> aluno_dispositivos, responsavel_alunos
 *               somem junto, em silencio
 *   SET NULL -> registros_ponto.aluno_id
 *               as batidas FICAM, sem dono, e caem em "batidas sem vinculo"
 *   RESTRICT -> notas_alunos, observacoes_alunos
 *   NO ACTION-> presencas_sala (presencas_sala_aluno_empresa_fk, sem clausula)
 *               essas TRES recusam a exclusao
 */
export default function ConfirmarExclusaoAluno({ aluno, aoFechar, aoExcluir }) {
  const caixa = useRef(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [batidas, setBatidas] = useState(null); // null = ainda contando
  const [erro, setErro] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  // Contagem real, em vez de "pode haver batidas": o numero muda a decisao.
  useEffect(() => {
    let ativo = true;
    api.frequenciaAluno(aluno.id)
      .then((r) => { if (ativo) setBatidas((r.registros || []).length); })
      .catch(() => { if (ativo) setBatidas('indisponivel'); });
    return () => { ativo = false; };
  }, [aluno.id]);

  // Mesmo piso do SelecionarFilialModal: foco preso, Esc fecha, sem rolagem atras.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return undefined;
    const focaveis = el.querySelectorAll('a,button,input,[tabindex]:not([tabindex="-1"])');
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (primeiro) primeiro.focus();

    const aoTeclar = (e) => {
      if (e.key === 'Escape') { aoFechar(); return; }
      if (e.key !== 'Tab' || focaveis.length === 0) return;
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', aoTeclar);
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = rolagem;
    };
  }, [aoFechar]);

  const liberado = confirmacao.trim().toLowerCase() === String(aluno.nome).trim().toLowerCase();

  async function excluir() {
    if (!liberado) return;
    setErro(null);
    setExcluindo(true);
    try {
      await api.excluirAluno(aluno.id);
      aoExcluir(aluno);
    } catch (err) {
      /**
       * Uma recusa do banco NAO e um AppError, entao o errorHandler devolve 500
       * e mascara a mensagem como "Erro interno. Tente novamente." — inutil, e
       * faria a pessoa tentar de novo para sempre. Nesta rota a causa provavel
       * de um 500 e a trava de integridade, entao explicamos em vez de repetir
       * o texto generico.
       */
      const generico = /erro interno/i.test(err.message || '');
      setErro(generico
        ? 'O banco recusou a exclusão. A causa provável é o aluno já ter nota, observação ou chamada registrada — esses vínculos bloqueiam a remoção de propósito. O servidor não detalha o motivo; o log do Render tem a exceção real.'
        : err.message || 'Não foi possível excluir o aluno.');
      setExcluindo(false);
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={aoFechar}>
      <div
        ref={caixa}
        className="modal modal-perigo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="excl-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="excl-titulo">Excluir {aluno.nome}?</h2>
        <p className="texto-apoio" style={{ marginTop: 0 }}>
          A exclusão é permanente e não tem desfazer. Se a intenção é só tirar o
          aluno da operação, cancele e use a edição para deixá-lo inativo.
        </p>

        {erro && <div className="erro">{erro}</div>}

        <div className="risco risco-apaga">
          <h3>Some junto, sem aviso</h3>
          <ul>
            <li>O <strong>vínculo com o equipamento facial</strong> — o aluno deixa de ser reconhecido na catraca.</li>
            <li>O <strong>vínculo com o responsável</strong> — ele perde o acesso a este aluno no aplicativo.</li>
          </ul>
        </div>

        <div className="risco risco-orfao">
          <h3>Fica no banco, sem dono</h3>
          <p>
            {batidas === null && 'Contando as batidas deste aluno...'}
            {batidas === 'indisponivel' && (
              <>Não foi possível contar as batidas deste aluno. Elas <strong>não são apagadas</strong> — passam a existir sem vínculo.</>
            )}
            {typeof batidas === 'number' && (
              <>
                <strong className="mono">{batidas}</strong>{' '}
                {batidas === 1 ? 'batida de ponto' : 'batidas de ponto'}
                {batidas === 0
                  ? ' — nada a desvincular.'
                  : ` ${batidas === 1 ? 'continua' : 'continuam'} no banco e ${batidas === 1 ? 'passa' : 'passam'} a aparecer em “Batidas sem vínculo”, sem voltar a apontar para ninguém.`}
              </>
            )}
          </p>
        </div>

        <div className="risco risco-bloqueia">
          <h3>Pode ser recusado pelo banco</h3>
          <p>
            Se este aluno já tem <strong>nota</strong>, <strong>observação</strong> ou{' '}
            <strong>chamada</strong> registrada, a exclusão será bloqueada — e a mensagem
            que volta é genérica, não explica o motivo.
          </p>
        </div>

        <div className="campo" style={{ marginTop: 16 }}>
          <label htmlFor="excl-nome">
            Para confirmar, digite o nome do aluno
          </label>
          <input
            id="excl-nome"
            className="entrada"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder={aluno.nome}
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        <div className="acoes-form">
          <button type="button" className="btn btn-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-perigo"
            disabled={!liberado || excluindo}
            onClick={excluir}
          >
            {excluindo ? 'Excluindo...' : 'Excluir definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}
