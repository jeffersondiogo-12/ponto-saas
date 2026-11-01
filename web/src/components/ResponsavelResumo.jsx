import { iniciais, soDigitos } from '../utils/dominio';

/**
 * Um responsavel numa linha: iniciais, nome, parentesco e os contatos. Usado
 * no bloco "Responsável" do AlunoForm, na tela "Acesso do responsável" e no
 * sino de pedidos. Vai dentro de um `<ul className="responsaveis">`.
 *
 * E-mail e telefone sao links (mailto/tel): quem trata um pedido de
 * vinculacao precisa falar com o responsavel antes de ligar. `acoes` sao os
 * botoes da direita; `detalhe` e uma linha a mais (o aluno de um pedido).
 */
export default function ResponsavelResumo({ nome, email, telefone, parentesco, ativo = true, detalhe, nota, acoes }) {
  return (
    <li className="responsavel">
      <span className="responsavel-avatar" aria-hidden="true">{iniciais(nome)}</span>
      <div>
        <div className="responsavel-topo">
          <strong>{nome}</strong>
          {parentesco && <span className="badge badge-info">{parentesco}</span>}
          {!ativo && <span className="badge badge-inativo">Conta inativa</span>}
        </div>
        {(email || telefone) && (
          <div className="responsavel-contatos">
            {email && <span><span className="rotulo">E-mail</span><a href={`mailto:${email}`}>{email}</a></span>}
            {telefone && <span><span className="rotulo">Telefone</span><a href={`tel:${soDigitos(telefone)}`}>{telefone}</a></span>}
          </div>
        )}
        {detalhe && <div className="responsavel-detalhe">{detalhe}</div>}
        {nota && <span className="ajuda">{nota}</span>}
      </div>
      {acoes && <div className="responsavel-acoes">{acoes}</div>}
    </li>
  );
}
