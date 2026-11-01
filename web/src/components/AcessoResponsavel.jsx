import { useEffect, useRef, useState } from 'react';
import { api, payloadAluno } from '../api';
import ResponsavelResumo from './ResponsavelResumo';

const VAZIO = { nome: '', email: '', telefone: '', parentesco: '', senha: '', confirmacao: '' };

const SEM_PERMISSAO = {
  ver: 'Você não tem permissão para ver os responsáveis. Peça ao super admin para liberar “Responsáveis: ver” em Permissões.',
  adicionar: 'Você não tem permissão para vincular responsáveis. Peça ao super admin para liberar “Responsáveis: adicionar” em Permissões.',
  atualizar: 'Você não tem permissão para alterar a conta do responsável. Peça ao super admin para liberar “Responsáveis: atualizar” em Permissões.',
  ambiente: 'Editar a conta vale para todas as escolas e pede alcance de ambiente. Peça a um admin sem escola fixa ou, se for super admin, entre em “Supervisionar o ambiente”.',
  // Pela rota do aluno, o parentesco e do vinculo; o resto e da conta (4f78c4e).
  contaPeloAluno: 'Nome, e-mail, telefone e senha valem para todas as escolas desse responsável e pedem alcance de ambiente. Daqui você pode mudar só o parentesco. Para o resto, peça a um admin sem escola fixa ou, se for super admin, entre em “Supervisionar o ambiente”.',
};

/** Confere o formulario; devolve o que esta errado ou null. Conta nova exige senha. */
function conferir(f, novo) {
  if (!f.nome.trim()) return 'Informe o nome do responsável.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Informe um e-mail válido para o responsável.';
  if (novo && f.senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!novo && f.senha && f.senha.length < 8) return 'A senha nova precisa ter pelo menos 8 caracteres.';
  if (f.senha !== f.confirmacao) return 'A senha e a confirmação não conferem.';
  return null;
}

/** So o que mudou em relacao a conta: o servidor audita campo a campo. */
function mudancas(dados, original, senha) {
  const mudou = Object.fromEntries(Object.entries(dados).filter(([campo, valor]) => valor !== (original[campo] ?? null)));
  if (senha) mudou.senha = senha;
  return mudou;
}

/** A conta dona deste e-mail, ou null. Sem permissao de ver, quem barra e o servidor (409). */
async function contaDoEmail(email) {
  try {
    const { responsaveis } = await api.buscarResponsaveis(email);
    return (responsaveis || []).find((r) => r.email.toLowerCase() === email) || null;
  } catch {
    return null;
  }
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
 * Telas: `lista` (so na edicao: quem acompanha o aluno, com Editar) ->
 * `escolha` -> `buscar` (Selecionar existente: Selecionar ou Editar a conta)
 * ou `novo` (Criar acesso novo: e-mail de conta existente e barrado, e o
 * cartao dela aparece para selecionar) -> `vincular` (parentesco e confirmar).
 *
 * - Cadastro (sem `aluno`): so junta a escolha e devolve por `aoGuardar`; ela
 *   vai no POST do aluno (`responsavel_id` + `parentesco`, ou `responsavel`).
 * - Edicao (com `aluno`): salva na hora. Vincular existente pela rota
 *   `vincular-responsavel`; conta nova pelo PUT do aluno com `responsavel`,
 *   montado com o payloadAluno do registro do SERVIDOR (nao grava edicao do
 *   formulario pela metade).
 * - Editar: a conta de quem ja acompanha o aluno vai pela rota do aluno (com
 *   parentesco); a de quem veio da busca, pela rota do ambiente (sem
 *   parentesco, vale para todas as escolas, pede alcance de ambiente).
 *
 * `<dialog>` nativo, como a FichaAluno. Fica fora do <form> do AlunoForm:
 * formulario dentro de formulario nao e HTML valido.
 */
export default function AcessoResponsavel({ aluno, inicial, aoGuardar, aoAlunoSalvo, aoMudar, aoFechar }) {
  const cadastro = !aluno;
  const caixa = useRef(null);
  const [tela, setTela] = useState(cadastro ? 'escolha' : 'lista');
  const [lista, setLista] = useState(null);
  const [erroLista, setErroLista] = useState(null);
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState(null);
  const [escolhido, setEscolhido] = useState(null);
  const [parentescoVinculo, setParentescoVinculo] = useState('');
  const [voltarPara, setVoltarPara] = useState('buscar');
  const [conflito, setConflito] = useState(null);
  const [f, setF] = useState({ ...VAZIO, ...inicial });
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const fechar = () => caixa.current?.close();
  const idsDoAluno = new Set((lista || []).map((r) => r.id));
  const set = (campo, valor) => {
    setF((x) => ({ ...x, [campo]: valor }));
    if (campo === 'email') setConflito(null);
  };

  function ir(proxima) {
    setErro(null);
    setAviso(null);
    setConflito(null);
    setTela(proxima);
  }

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

  function abrirFormulario(proxima, r = null) {
    setEscolhido(r);
    setF(r
      ? { ...VAZIO, nome: r.nome || '', email: r.email || '', telefone: r.telefone || '', parentesco: r.parentesco || '' }
      : { ...VAZIO, ...inicial });
    ir(proxima);
  }

  function abrirVincular(r, origem, parentesco = '') {
    setEscolhido(r);
    setVoltarPara(origem);
    setParentescoVinculo(parentesco);
    ir('vincular');
  }

  async function buscar(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    const termo = busca.trim();
    if (termo.length < 3) { setErro('Digite pelo menos 3 letras do nome ou do e-mail.'); return; }
    setSalvando(true);
    try {
      const resposta = await api.buscarResponsaveis(termo);
      setResultados(resposta.responsaveis || []);
    } catch (err) {
      setResultados(null);
      setErro(err.status === 403 ? SEM_PERMISSAO.ver : err.message || 'Não foi possível buscar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  // Depois de salvar na edicao: volta para a lista, recarrega e avisa o formulario.
  async function concluir(mensagem) {
    ir('lista');
    setAviso(mensagem);
    await carregar();
    aoMudar?.();
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    if (tela !== 'vincular') {
      const problema = conferir(f, tela === 'novo');
      if (problema) { setErro(problema); return; }
    }
    const dados = { nome: f.nome.trim(), email: f.email.trim().toLowerCase(), telefone: f.telefone.trim() || null };
    const parentesco = f.parentesco.trim() || null;

    // Na edicao pela rota do aluno, mexer na conta (nao so no parentesco) pede
    // alcance de ambiente: o 403 diz isso, e nao "falta a permissao".
    let mexeuNaConta = false;
    setSalvando(true);
    try {
      if (tela === 'vincular') {
        const parentescoEscolhido = parentescoVinculo.trim() || null;
        if (cadastro) {
          const { id, nome, email, telefone } = escolhido;
          aoGuardar({ existente: true, id, nome, email, telefone, parentesco: parentescoEscolhido });
          fechar();
          return;
        }
        // Ligar fecha, no servidor, o pedido pendente dessa pessoa para este aluno.
        const resposta = await api.vincularResponsavelAoAluno(aluno.id, escolhido.id, parentescoEscolhido);
        await concluir(`${escolhido.nome} agora acompanha ${aluno.nome} pelo aplicativo.${
          resposta.pedidosAprovados?.length ? ' O pedido de vinculação dele saiu da lista de pendentes.' : ''}`);
      } else if (tela === 'novo') {
        // O servidor tambem barra (409); aqui a tela mostra de quem e o e-mail.
        const dono = await contaDoEmail(dados.email);
        if (dono) { setConflito(dono); return; }
        if (cadastro) {
          aoGuardar({ ...dados, parentesco, senha: f.senha });
          fechar();
          return;
        }
        const resposta = await api.atualizarAluno(aluno.id, payloadAluno(aluno, { responsavel: { ...dados, parentesco, senha: f.senha } }));
        if (resposta.aluno) aoAlunoSalvo(resposta.aluno);
        await concluir('Acesso criado. O responsável já pode entrar no aplicativo.');
      } else if (tela === 'editarVinculo') {
        const mudou = mudancas({ ...dados, parentesco }, escolhido, f.senha);
        if (!Object.keys(mudou).length) { ir('lista'); return; }
        mexeuNaConta = Object.keys(mudou).some((campo) => campo !== 'parentesco');
        await api.atualizarContaResponsavel(aluno.id, escolhido.id, mudou);
        await concluir(mudou.senha ? 'Acesso atualizado, com a senha nova.' : 'Acesso atualizado.');
      } else {
        const mudou = mudancas(dados, escolhido, f.senha);
        if (!Object.keys(mudou).length) { ir('buscar'); return; }
        const { responsavel } = await api.atualizarResponsavel(escolhido.id, mudou);
        setResultados((rs) => rs?.map((r) => (r.id === responsavel.id ? { ...r, ...responsavel } : r)));
        ir('buscar');
        setAviso('Conta atualizada. Vale para todos os alunos desse responsável.');
        if (idsDoAluno.has(responsavel.id)) { await carregar(); aoMudar?.(); }
      }
    } catch (err) {
      const semPermissao = {
        vincular: SEM_PERMISSAO.adicionar,
        editarVinculo: mexeuNaConta ? SEM_PERMISSAO.contaPeloAluno : SEM_PERMISSAO.atualizar,
        editarConta: SEM_PERMISSAO.ambiente,
      }[tela];
      setErro(err.status === 403 && semPermissao ? semPermissao : err.message || 'Não foi possível salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  const textoSalvar = salvando ? 'Salvando...' : cadastro && tela === 'novo' ? 'Guardar' : 'Salvar';

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
            ? 'O acesso é criado ou vinculado junto com o aluno, ao clicar em “Cadastrar aluno”.'
            : `Quem acompanha ${aluno.nome} pelo aplicativo.`}
        </p>

        {erro && <div className="erro">{erro}</div>}
        {aviso && <div className="aviso">{aviso}</div>}

        {tela === 'lista' && (
          <>
            {lista === null && <p className="texto-apoio">Carregando...</p>}
            {erroLista && <div className="erro">{erroLista}</div>}
            {lista && !erroLista && !lista.length && (
              <p className="texto-apoio">Nenhum responsável com acesso ao aplicativo.</p>
            )}
            {lista?.length > 0 && (
              <ul className="responsaveis">
                {lista.map((r) => (
                  <ResponsavelResumo
                    key={r.id}
                    {...r}
                    acoes={<button type="button" className="btn btn-secundario" onClick={() => abrirFormulario('editarVinculo', r)}>Editar</button>}
                  />
                ))}
              </ul>
            )}
            <div className="acoes-form">
              <button type="button" className="btn btn-secundario" onClick={fechar}>Fechar</button>
              <button type="button" className="btn btn-primario" onClick={() => ir('escolha')}>Adicionar responsável</button>
            </div>
          </>
        )}

        {tela === 'escolha' && (
          <>
            <div style={{ display: 'grid', gap: 6 }}>
              <button type="button" className="btn btn-secundario" onClick={() => { setBusca(''); setResultados(null); ir('buscar'); }}>
                Selecionar responsável existente
              </button>
              <span className="ajuda">Para quem já tem conta no aplicativo, como o responsável de um irmão.</span>
              <button type="button" className="btn btn-secundario" style={{ marginTop: 10 }} onClick={() => abrirFormulario('novo')}>
                Criar acesso novo
              </button>
              <span className="ajuda">Para quem ainda não tem conta. E-mail de uma conta que já existe é recusado.</span>
            </div>
            <div className="acoes-form">
              <button type="button" className="btn btn-secundario" onClick={() => (cadastro ? fechar() : ir('lista'))}>
                {cadastro ? 'Cancelar' : 'Voltar'}
              </button>
            </div>
          </>
        )}

        {tela === 'buscar' && (
          <>
            <form onSubmit={buscar} noValidate style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ flex: '1 1 240px' }}>
                <Campo id="ac-busca" rotulo="Nome ou e-mail do responsável" value={busca} autoComplete="off"
                  placeholder="pelo menos 3 letras" onChange={(e) => setBusca(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primario" disabled={salvando}>{salvando ? 'Buscando...' : 'Buscar'}</button>
            </form>
            {resultados && !resultados.length && (
              <p className="texto-apoio">Nenhum responsável encontrado. Confira o que digitou ou crie um acesso novo.</p>
            )}
            {resultados?.length > 0 && (
              <ul className="responsaveis">
                {resultados.map((r) => {
                  const jaAcompanha = idsDoAluno.has(r.id);
                  return (
                    <ResponsavelResumo
                      key={r.id}
                      {...r}
                      nota={jaAcompanha ? 'Já acompanha este aluno.' : undefined}
                      acoes={(
                        <>
                          <button type="button" className="btn btn-primario" disabled={!r.ativo || jaAcompanha}
                            onClick={() => abrirVincular(r, 'buscar')}>Selecionar</button>
                          <button type="button" className="btn btn-secundario" onClick={() => abrirFormulario('editarConta', r)}>Editar</button>
                        </>
                      )}
                    />
                  );
                })}
              </ul>
            )}
            <div className="acoes-form">
              <button type="button" className="btn btn-secundario" onClick={() => ir('escolha')}>Voltar</button>
            </div>
          </>
        )}

        {tela === 'vincular' && (
          <form onSubmit={salvar} noValidate>
            <ul className="responsaveis"><ResponsavelResumo {...escolhido} /></ul>
            <div className="grid-form">
              <Campo id="ac-vinculo-parentesco" rotulo="Parentesco com o aluno" value={parentescoVinculo} maxLength={40}
                placeholder="pai, mãe, avó, tutor..." onChange={(e) => setParentescoVinculo(e.target.value)} />
            </div>
            <span className="ajuda">
              {cadastro
                ? 'A conta é vinculada ao clicar em “Cadastrar aluno”. A senha dela não muda.'
                : 'A conta passa a acompanhar o aluno no aplicativo. A senha dela não muda.'}
            </span>
            <div className="acoes-form">
              <button type="button" className="btn btn-secundario" onClick={() => ir(voltarPara)}>Voltar</button>
              <button type="submit" className="btn btn-primario" disabled={salvando}>
                {salvando ? 'Salvando...' : cadastro ? 'Guardar' : 'Vincular'}
              </button>
            </div>
          </form>
        )}

        {['novo', 'editarVinculo', 'editarConta'].includes(tela) && (
          <form onSubmit={salvar} noValidate>
            {tela === 'editarConta' && (
              <p className="ajuda" style={{ marginTop: 0 }}>A conta vale para todos os alunos desse responsável.</p>
            )}
            <div className="grid-form">
              <Campo id="ac-nome" rotulo="Nome" obrigatorio value={f.nome} maxLength={150}
                onChange={(e) => set('nome', e.target.value)} />
              <Campo id="ac-email" rotulo="E-mail de acesso" obrigatorio type="email" value={f.email} maxLength={150}
                autoComplete="off" placeholder="responsavel@email.com" onChange={(e) => set('email', e.target.value)} />
              <Campo id="ac-telefone" rotulo="Telefone" value={f.telefone} maxLength={20}
                placeholder="(81) 99999-9999" onChange={(e) => set('telefone', e.target.value)} />
              {tela !== 'editarConta' && (
                <Campo id="ac-parentesco" rotulo="Parentesco" value={f.parentesco} maxLength={40}
                  placeholder="pai, mãe, avó, tutor..." onChange={(e) => set('parentesco', e.target.value)} />
              )}
              <Campo id="ac-senha" rotulo={tela === 'novo' ? 'Senha' : 'Nova senha'} obrigatorio={tela === 'novo'}
                type="password" value={f.senha} autoComplete="new-password" onChange={(e) => set('senha', e.target.value)}
                ajuda={tela === 'novo' ? 'Pelo menos 8 caracteres.' : 'Deixe em branco para manter a senha atual.'} />
              <Campo id="ac-confirmacao" rotulo="Confirmar senha" obrigatorio={tela === 'novo'} type="password"
                value={f.confirmacao} autoComplete="new-password" onChange={(e) => set('confirmacao', e.target.value)} />
            </div>

            {conflito && (
              <>
                <div className="erro">Este e-mail já é de uma conta. Para ligar essa pessoa ao aluno, selecione a conta abaixo.</div>
                <ul className="responsaveis">
                  <ResponsavelResumo
                    {...conflito}
                    nota={idsDoAluno.has(conflito.id) ? 'Já acompanha este aluno.' : undefined}
                    acoes={(
                      <button type="button" className="btn btn-primario" disabled={!conflito.ativo || idsDoAluno.has(conflito.id)}
                        onClick={() => abrirVincular(conflito, 'novo', f.parentesco)}>Selecionar</button>
                    )}
                  />
                </ul>
              </>
            )}

            <div className="acoes-form">
              <button type="button" className="btn btn-secundario"
                onClick={() => ir({ novo: 'escolha', editarVinculo: 'lista', editarConta: 'buscar' }[tela])}>
                Voltar
              </button>
              <button type="submit" className="btn btn-primario" disabled={salvando}>{textoSalvar}</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
