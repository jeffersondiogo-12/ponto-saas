import { useEffect, useRef } from 'react';
import Icone from '../app/Icone';
import FotoDoAluno from './FotoDoAluno';
import { mascaraCpf } from '../utils/dominio';

const dataBr = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '—');

/**
 * Quantos responsaveis tem conta no app ligada ao aluno. O campo
 * `responsaveis_vinculados` vem do back-end (pedido ao Jefferson em
 * 2026-10-20); enquanto ele nao chega, quem chama nao mostra a linha - a tela
 * nao inventa dado.
 */
export function ResponsavelVinculado({ quantidade }) {
  if (!quantidade) return <span className="sem-vinculo">Sem responsável no app</span>;
  return (
    <span className="vinculo">
      <Icone nome="people" tamanho={15} />
      {quantidade === 1 ? '1 responsável vinculado' : `${quantidade} responsáveis vinculados`}
    </span>
  );
}

/**
 * Ficha do aluno, aberta pelo card da lista. So leitura: mostra o que a
 * listagem ja trouxe (`GET /api/alunos` devolve `a.*`), sem outra requisicao.
 *
 * `<dialog>` nativo com `showModal()`: Esc fecha, o foco entra e a tela de
 * tras fica inerte - o que os outros modais do sistema fazem a mao.
 */
export default function FichaAluno({ aluno, podeExcluir, aoFechar, aoEditar, aoExcluir }) {
  const caixa = useRef(null);
  useEffect(() => { caixa.current?.showModal(); }, []);
  const fechar = () => caixa.current?.close();

  return (
    <dialog
      ref={caixa}
      className="modal ficha-aluno"
      aria-labelledby="ficha-titulo"
      onClose={aoFechar}
      // O clique no fundo escuro chega ao proprio <dialog>; dentro dele, quem
      // recebe e o miolo - por isso o miolo leva o padding, e o dialog nao.
      onClick={(e) => { if (e.target === caixa.current) fechar(); }}
    >
      <div className="ficha-miolo">
        <div className="ficha-topo">
          <FotoDoAluno alunoId={aluno.id} nome={aluno.nome} temFoto={aluno.tem_foto} className="ficha-foto" />
          <div>
            <h2 id="ficha-titulo">{aluno.nome}</h2>
            <span className={`badge ${aluno.ativo ? 'badge-ativo' : 'badge-inativo'}`}>
              {aluno.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>

        <dl className="ficha-dados">
          <dt>Escola</dt><dd>{aluno.filial_nome || '—'}</dd>
          <dt>Turma</dt><dd>{aluno.turma_nome || 'Sem turma'}</dd>
          <dt>Matrícula</dt><dd className="mono">{aluno.matricula || 'Sem matrícula'}</dd>
          <dt>CPF</dt><dd className="mono">{aluno.cpf ? mascaraCpf(aluno.cpf) : '—'}</dd>
          <dt>Nascimento</dt><dd className="mono">{dataBr(aluno.data_nascimento)}</dd>
          <dt>Responsável</dt><dd>{aluno.nome_responsavel || '—'}</dd>
          <dt>Contato</dt><dd>{aluno.contato_responsavel || '—'}</dd>
          {'responsaveis_vinculados' in aluno && (
            <>
              <dt>No aplicativo</dt>
              <dd><ResponsavelVinculado quantidade={aluno.responsaveis_vinculados} /></dd>
            </>
          )}
        </dl>

        <div className="acoes-form">
          {podeExcluir && (
            <button type="button" className="btn btn-perigo" onClick={aoExcluir}>Excluir</button>
          )}
          <button type="button" className="btn btn-secundario" onClick={fechar}>Fechar</button>
          <button type="button" className="btn btn-primario" onClick={aoEditar}>Editar</button>
        </div>
      </div>
    </dialog>
  );
}
