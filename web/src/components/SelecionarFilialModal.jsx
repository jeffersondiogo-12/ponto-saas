import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const FOCAVEIS = 'a,button:not(:disabled),input,select,textarea,[tabindex]:not([tabindex="-1"])';

// Icones da escolha do super_admin, no traco dos icones da barra lateral.
const tracos = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const IconeSupervisionar = () => (
  <svg {...tracos}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
const IconeAdministrar = () => (
  <svg {...tracos}><path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 9h3a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3" /></svg>
);

// Busca sem acento e sem caixa: "sao jose" acha "São José".
const semAcento = (texto) => String(texto || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// Regras por papel:
// - 'admin'  -> escolhe a filial quando houver mais de uma
// - 'super_admin' -> sempre escolhe: supervisionar o ambiente ou administrar uma unidade
// A janela nao fecha para ninguem (Samuel, 2026-10-21): sem Fechar, Esc ou clique fora.
// - 'staff'  -> gestor: tenta auto-selecionar a filial vinculada ao usuario (usuario.filial_id)
// - 'rh'     -> permanece no ambiente (empresa) e nao precisa escolher filial

export default function SelecionarFilialModal() {
  const { empresaSelecionada, filialSelecionada, selecionarFilial, supervisionar, modo, pedidoEntrada, usuario } = useAuth();
  const [filiais, setFiliais] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  // Super_admin: primeiro a escolha (supervisionar ou administrar); depois,
  // se administrar, a busca da unidade - um ambiente pode ter dezenas.
  const [etapa, setEtapa] = useState('escolha');
  const [busca, setBusca] = useState('');
  // "Tentar de novo" quando a lista de unidades falha: muda e a carga roda outra vez.
  const [tentativa, setTentativa] = useState(0);
  const modalRef = useRef(null);
  // efeito principal: carregar filiais e aplicar regras por papel
  useEffect(() => {
    let mounted = true;
    async function carregar() {
      if (!empresaSelecionada || filialSelecionada) return;
      // comportamento para papeis
      const papel = usuario?.papel;
      // Supervisionando, o super_admin ja escolheu: sem unidade, de proposito.
      if (papel === 'super_admin' && modo === 'supervisionar') return;
      setMensagem(null);
      if (papel === 'rh') {
        // RH não precisa escolher filial — mantemos aberto=false
        return;
      }
      /**
       * Quem já tem unidade FIXA na conta não escolhe nada — é o caso do
       * gestor. O servidor escopa tudo por `usuario.filial_id`, e o menu
       * reconhece isso pelo `operaEmEscola`.
       *
       * Sair aqui evita dois 403 garantidos: ler a própria unidade
       * (`GET /api/filiais/:id`) e listar as da empresa (`GET /api/filiais`)
       * exigem `filiais:ver`, que o gestor não tem. Antes o código tentava as
       * duas, o `catch` engolia o erro e o modal nunca abria — a pessoa ficava
       * sem unidade selecionada para sempre, e o menu perdia Alunos, Turmas e
       * Gestão sem dizer por quê.
       *
       * (O ramo antigo comparava `papel === 'staff'`. `'staff'` é o TIPO do
       * token, nunca um papel, então ele nunca rodou.)
       */
      /**
       * O super_admin nao entra aqui: o servidor ignora o filial_id dele (o
       * resolverTenant so le o X-Filial-Id), entao ele sempre escolhe. Esse
       * filial_id nem vem do cadastro: e a unidade que casou com o termo
       * digitado em "Ambiente" no login. Antes, com ele, a janela nunca abria
       * e o "Trocar" da barra nao a trazia de volta.
       */
      if (usuario?.filial_id && papel !== 'super_admin') return;
      setCarregando(true);
      try {
        const res = await api.listarUnidades();
        if (!mounted) return;
        const items = res.filiais || res.unidades || [];
        // filtra apenas filiais ativas da empresa selecionada
        const encontrado = items.filter((f) => String(f.empresa_id) === String(empresaSelecionada.id) && f.ativo);
        setFiliais(encontrado);
        if (papel === 'super_admin') {
          // O super_admin sempre escolhe como entra - supervisionar ou
          // administrar -, mesmo com uma unidade so, ou nenhuma.
          setEtapa('escolha');
          setBusca('');
          setAberto(true);
        } else if (encontrado.length === 1) {
          // auto-seleciona a única filial ativa
          const f = encontrado[0];
          selecionarFilial({ id: f.id, nome: f.nome || f.cnpj || 'Filial', tipo: f.tipo || 'empresa' });
          setAberto(false);
        } else if (encontrado.length > 1) {
          // Mais de uma: a pessoa escolhe, e a janela so sai com a escolha feita.
          setAberto(true);
        }
      } catch (err) {
        if (!mounted) return;
        // A janela abre mesmo sem a lista e diz o que houve. Antes a falha era
        // calada: sem janela, sem unidade e sem saber por que.
        setFiliais([]);
        setMensagem(`Não foi possível carregar as unidades: ${err.message || 'erro desconhecido'}.`);
        setEtapa('escolha');
        setAberto(true);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
    return () => { mounted = false; };
  }, [empresaSelecionada, filialSelecionada, usuario, selecionarFilial, modo, tentativa, pedidoEntrada]);
  const ehSuper = usuario?.papel === 'super_admin';

  function entrarSupervisionando() {
    supervisionar();
    setAberto(false);
  }

  function escolher(f) {
    selecionarFilial({ id: f.id, nome: f.nome || f.cnpj || 'Filial', tipo: f.tipo || 'empresa' });
    setAberto(false);
  }

  const termo = semAcento(busca.trim());
  const filiaisVisiveis = termo ? filiais.filter((f) => semAcento(f.nome || f.cnpj).includes(termo)) : filiais;

  // Foco preso na janela e sem rolagem atras. Sem Esc e sem clique fora: a
  // janela nao fecha (Samuel, 2026-10-21) - escolher onde trabalhar nao e
  // opcional. A lista de focaveis e lida a cada Tab, porque a busca a troca.
  useEffect(() => {
    if (!aberto) return undefined;
    const el = modalRef.current;
    if (!el) return undefined;
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (el.querySelector('[data-foco-inicial]') || el.querySelector(FOCAVEIS))?.focus();

    function aoTeclar(e) {
      if (e.key !== 'Tab') return;
      const focaveis = [...el.querySelectorAll(FOCAVEIS)];
      if (!focaveis.length) {
        e.preventDefault();
        return;
      }
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = rolagem;
    };
  }, [aberto, etapa]);

  if (!aberto || carregando) return null;

  const avisoErro = mensagem && (
    <div className="aviso">
      {mensagem}{' '}
      {ehSuper ? 'Tente de novo ou entre supervisionando.' : 'Tente de novo em instantes.'}{' '}
      <button type="button" className="btn btn-secundario" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button>
    </div>
  );

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-selecionar-filial" ref={modalRef}>
        {ehSuper && etapa === 'escolha' ? (
          <>
            <h2 id="titulo-selecionar-filial">Como você quer entrar?</h2>
            <p className="texto-apoio">Ambiente: <strong>{empresaSelecionada?.nome}</strong></p>
            {avisoErro}
            <div className="entrada-opcoes">
              <button type="button" className="entrada-opcao" onClick={entrarSupervisionando} data-foco-inicial>
                <IconeSupervisionar />
                <strong>Supervisionar</strong>
                <span>Todo o ambiente, sem filtro.</span>
              </button>
              <button type="button" className="entrada-opcao" onClick={() => { setBusca(''); setEtapa('unidades'); }}>
                <IconeAdministrar />
                <strong>Administrar</strong>
                <span>Uma unidade por vez.</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {ehSuper && (
              <button type="button" className="botao-voltar" onClick={() => setEtapa('escolha')}>&larr; Voltar</button>
            )}
            <h2 id="titulo-selecionar-filial">{ehSuper ? 'Qual unidade administrar?' : 'Escolha a filial'}</h2>
            <p className="texto-apoio">Ambiente: <strong>{empresaSelecionada?.nome}</strong></p>
            {avisoErro}
            {filiais.length > 0 && (
              <div className="campo">
                <label htmlFor="busca-unidade">Buscar unidade</label>
                <input
                  id="busca-unidade"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome da unidade"
                  autoComplete="off"
                  data-foco-inicial
                />
              </div>
            )}
            <div className="lista-filiais">
              {filiais.length === 0 && (
                <div className="texto-apoio">
                  {ehSuper
                    ? 'Nenhuma unidade neste ambiente. Volte, entre supervisionando e cadastre uma em Unidades.'
                    : 'Nenhuma filial encontrada para este ambiente.'}
                </div>
              )}
              {filiais.length > 0 && filiaisVisiveis.length === 0 && (
                <div className="texto-apoio">Nenhuma unidade com esse nome.</div>
              )}
              {filiaisVisiveis.map((f) => (
                <button key={f.id} type="button" className="item-filial item-filial-botao" onClick={() => escolher(f)}>
                  <strong>{f.nome || f.cnpj}</strong>
                  <span className="texto-apoio">{f.tipo === 'escola' ? 'Escola' : 'Empresa'}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
