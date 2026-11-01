import { useEffect, useRef, useState } from 'react';
import { api, payloadAluno } from '../api';

const VAZIO = { nome: '', email: '', telefone: '', parentesco: '', senha: '', confirmacao: '' };

const SEM_PERMISSAO = {
  ver: 'Você não tem permissão para ver os responsáveis. Peça ao super admin para liberar “Responsáveis: ver” em Permissões. Adicionar um acesso continua possível.',
  atualizar: 'Você não tem permissão para alterar a conta do responsável. Peça ao super admin para liberar “Responsáveis: atualizar” em Permissões.',
};

/** Confere o formulario; devolve o que esta errado ou null. */
function conferir(f) {
  if (!f.nome.trim()) return 'Informe o nome do responsável.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Informe um e-mail válido para o responsável.';
  if (f.senha && f.senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (f.senha !== f.confirmacao) return 'A senha e a confirmação não conferem.';
  return null;
}

function Campo({ id, rotulo, obrigatorio, ajuda, ...props }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}{obrigatorio && <span className="obrigatorio"> *</span>}</label>
      <input id={id} {...props} />
      {ajuda && <span className="ajuda">{ajuda}</span>}
    </div>
  );
}

/**
 * Acesso do responsavel ao aplicativo, aberto pelo botao do AlunoForm.
 *
 * - Cadastro (sem `aluno`): so junta os dados e devolve por `aoGuardar`; o
 *   acesso e criado junto com o aluno, no "Cadastrar aluno", como sempre foi.
 * - Edicao (com `aluno`): lista quem ja tem acesso, edita a conta (PATCH, so o
 *   que mudou - o servidor audita campo a campo) e adiciona na hora, pelo PUT do
 *   aluno com `responsavel`. O PUT reenvia o aluno como esta no SERVIDOR
 *   (payloadAluno), nao o formulario: dar acesso nao grava edicao pela metade.
 *
 * Senha opcional nos dois casos: o servidor so a exige para conta nova; se o
 * e-mail ja tem conta, liga ao aluno e mantem a senha dela.
 *
 * `<dialog>` nativo, como a FichaAluno. Fica fora do <form> do AlunoForm:
 * formulario dentro de formulario nao e HTML valido.
 */
export default function AcessoResponsavel({ aluno, inicial, aoGuardar, aoAlunoSalvo, aoFechar }) {
  const cadastro = !aluno;
  const caixa = useRef(null);
  const [lista, setLista] = useState(null);
  const [erroLista, setErroLista] = useState(null);
  // null = a lista; 'novo' = adicionar; um responsavel da lista = editar a conta dele.
  const [alvo, setAlvo] = useState(cadastro ? 'novo' : null);
  const [f, setF] = useState({ ...VAZIO, ...inicial });
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const set = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }));
  const fechar = () => caixa.current?.close();

  async function carregar() {
    try {
      const resposta = await api.listarResponsaveisDoAluno(aluno.id);
      setLista(resposta.responsaveis || []);
      setErroLista(null);
    } catch (err) {
      setLista([]);
      setErroLista(err.status === 403 ? SEM_PERMISSAO.ver : err.message || 'Não foi possível carregar os responsáveis.');
    }
  }

  useEffect(() => {
    caixa.current?.showModal();
    if (aluno) carregar();
    // So na abertura: depois, quem recarrega e o salvar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrir(responsavel) {
    setErro(null);
    setAviso(null);
    setAlvo(responsavel);
    setF(responsavel === 'novo'
      ? { ...VAZIO, ...inicial }
      : {
          ...VAZIO,
          nome: responsavel.nome || '',
          email: responsavel.email || '',
          telefone: responsavel.telefone || '',
          parentesco: responsavel.parentesco || '',
        });
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    const problema = conferir(f);
    if (problema) { setErro(problema); return; }

    const dados = {
      nome: f.nome.trim(),
      email: f.email.trim().toLowerCase(),
      telefone: f.telefone.trim() || null,
      parentesco: f.parentesco.trim() || null,
    };

    if (cadastro) {
      aoGuardar({ ...dados, senha: f.senha });
      fechar();
      return;
    }

    setSalvando(true);
    try {
      if (alvo === 'novo') {
        const resposta = await api.atualizarAluno(aluno.id, payloadAluno(aluno, { responsavel: { ...dados, senha: f.senha } }));
        if (resposta.aluno) aoAlunoSalvo(resposta.aluno);
        setAviso(resposta.responsavel && !resposta.responsavel.conta_criada
          ? 'Este e-mail já tinha conta: o responsável foi ligado ao aluno e a senha dele foi mantida.'
          : 'Acesso criado. O responsável já pode entrar no aplicativo.');
      } else {
        const mudou = Object.fromEntries(Object.entries(dados).filter(([campo, valor]) => valor !== (alvo[campo] ?? null)));
        if (f.senha) mudou.senha = f.senha;
        if (!Object.keys(mudou).length) { setAlvo(null); return; }
        await api.atualizarContaResponsavel(aluno.id, alvo.id, mudou);
        setAviso(mudou.senha ? 'Acesso atualizado, com a senha nova.' : 'Acesso atualizado.');
      }
      setAlvo(null);
      await carregar();
    } catch (err) {
      setErro(err.status === 403 && alvo !== 'novo'
        ? SEM_PERMISSAO.atualizar
        : err.message || 'Não foi possível salvar o acesso. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  const editandoConta = alvo && alvo !== 'novo';

  return (
    <dialog
      ref={caixa}
      className="modal ficha-aluno"
      aria-labelledby="acesso-titulo"
      onClose={aoFechar}
      onClick={(e) => { if (e.target === caixa.current) fechar(); }}
    >
      <div className="ficha-miolo">
        <h2 id="acesso-titulo">Acesso do responsável</h2>
        <p className="texto-apoio" style={{ marginTop: 0 }}>
          {cadastro
            ? 'O acesso ao aplicativo é criado junto com o aluno, ao clicar em “Cadastrar aluno”.'
            : `Quem entra no aplicativo para acompanhar ${aluno.nome}.`}
        </p>

        {erro && <div className="erro">{erro}</div>}
        {aviso && <div className="aviso">{aviso}</div>}

        {alvo === null ? (
          <>
            {lista === null && <p className="texto-apoio">Carregando...</p>}
            {erroLista && <div className="erro">{erroLista}</div>}
            {lista && !erroLista && !lista.length && (
              <p className="texto-apoio">Nenhum responsável com acesso ao aplicativo.</p>
            )}
            {lista && lista.length > 0 && (
              <div className="lista-filiais">
                {lista.map((r) => (
                  <div key={r.id} className="item-filial">
                    <div>
                      <strong>{r.nome}</strong>
                      {!r.ativo && <> <span className="badge badge-inativo">Inativo</span></>}
                      <div className="texto-apoio">
                        {[r.email, r.telefone, r.parentesco].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <button type="button" className="btn btn-secundario" onClick={() => abrir(r)}>Editar</button>
                  </div>
                ))}
              </div>
            )}
            <div className="acoes-form">
              <button type="button" className="btn btn-secundario" onClick={fechar}>Fechar</button>
              <button type="button" className="btn btn-primario" onClick={() => abrir('novo')}>Adicionar responsável</button>
            </div>
          </>
        ) : (
          <form onSubmit={salvar} noValidate>
            <div className="grid-form">
              <Campo id="ac-nome" rotulo="Nome" obrigatorio value={f.nome} maxLength={150}
                onChange={(e) => set('nome', e.target.value)} />
              <Campo id="ac-email" rotulo="E-mail de acesso" obrigatorio type="email" value={f.email} maxLength={150}
                autoComplete="off" placeholder="responsavel@email.com" onChange={(e) => set('email', e.target.value)} />
              <Campo id="ac-telefone" rotulo="Telefone" value={f.telefone} maxLength={20}
                placeholder="(81) 99999-9999" onChange={(e) => set('telefone', e.target.value)} />
              <Campo id="ac-parentesco" rotulo="Parentesco" value={f.parentesco} maxLength={40}
                placeholder="pai, mãe, avó, tutor..." onChange={(e) => set('parentesco', e.target.value)} />
              <Campo id="ac-senha" rotulo={editandoConta ? 'Nova senha' : 'Senha'} type="password" value={f.senha}
                autoComplete="new-password" onChange={(e) => set('senha', e.target.value)}
                ajuda={editandoConta
                  ? 'Deixe em branco para manter a senha atual.'
                  : 'Pelo menos 8 caracteres. Obrigatória para conta nova; se o e-mail já tiver conta, a senha dela é mantida.'} />
              <Campo id="ac-confirmacao" rotulo="Confirmar senha" type="password" value={f.confirmacao}
                autoComplete="new-password" onChange={(e) => set('confirmacao', e.target.value)} />
            </div>
            <div className="acoes-form">
              <button type="button" className="btn btn-secundario" onClick={() => (cadastro ? fechar() : (setErro(null), setAlvo(null)))}>
                {cadastro ? 'Cancelar' : 'Voltar'}
              </button>
              <button type="submit" className="btn btn-primario" disabled={salvando}>
                {salvando ? 'Salvando...' : cadastro ? 'Guardar' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
