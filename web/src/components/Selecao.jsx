import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Select com lista estilizada.
 *
 * O <select> nativo tem a lista desenhada pelo sistema operacional, que nao
 * aceita CSS em navegador nenhum. Para a lista seguir o design do sistema ela
 * precisa ser marcacao propria — e ai a acessibilidade que vinha de graca no
 * nativo passa a ser responsabilidade nossa. E o que este componente cobre:
 *
 *   - papel de combobox/listbox com aria-expanded, aria-activedescendant e
 *     aria-selected, para leitor de tela anunciar estado e opcao corrente;
 *   - teclado completo: setas, Home/End, Enter, Espaco, Esc, Tab;
 *   - busca por digitacao (digitar "se" pula para Setembro);
 *   - foco permanece no botao (padrao combobox), a lista e so visual;
 *   - clique fora fecha.
 *
 * Se um dia isto virar peso, o caminho de volta e o <select> nativo — que
 * funciona melhor no celular, so nao deixa pintar a lista.
 */
export default function Selecao({ valor, aoMudar, opcoes, id, rotuloAria, desabilitado = false, vazio = '—' }) {
  const [aberto, setAberto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const [posicao, setPosicao] = useState(null);
  const wrap = useRef(null);
  const botao = useRef(null);
  const lista = useRef(null);
  const busca = useRef({ texto: '', quando: 0 });
  const idAuto = useId();
  const idBase = id || idAuto;

  const indiceAtual = opcoes.findIndex((o) => String(o.valor) === String(valor));
  const escolhida = opcoes[indiceAtual];

  // Ao abrir, marca a opcao que ja esta selecionada.
  useEffect(() => {
    if (aberto) setMarcado(indiceAtual >= 0 ? indiceAtual : 0);
  }, [aberto, indiceAtual]);

  /**
   * A lista vai para um portal no <body>, com position:fixed. Sem isso ela e
   * recortada por qualquer ancestral com overflow — e o .card dos formularios
   * tem overflow:hidden, entao a lista aparecia cortada na borda do cartao.
   * O preco e ter de calcular a posicao na mao, e refazer no scroll/resize.
   */
  const medir = useCallback(() => {
    if (!botao.current) return;
    const r = botao.current.getBoundingClientRect();
    const espacoAbaixo = window.innerHeight - r.bottom;
    const alturaMax = 268;
    // Nao cabe embaixo mas cabe em cima: abre para cima.
    const paraCima = espacoAbaixo < alturaMax + 12 && r.top > espacoAbaixo;
    setPosicao({
      esquerda: r.left,
      largura: r.width,
      ...(paraCima ? { base: window.innerHeight - r.top + 6 } : { topo: r.bottom + 6 }),
      alturaDisponivel: Math.min(alturaMax, (paraCima ? r.top : espacoAbaixo) - 12),
    });
  }, []);

  useLayoutEffect(() => { if (aberto) medir(); }, [aberto, medir]);

  useEffect(() => {
    if (!aberto) return undefined;
    const clique = (e) => {
      const dentroDoBotao = wrap.current && wrap.current.contains(e.target);
      const dentroDaLista = lista.current && lista.current.contains(e.target);
      if (!dentroDoBotao && !dentroDaLista) setAberto(false);
    };
    // capture: pega o scroll de qualquer container, nao so o da janela.
    const remedir = () => medir();
    document.addEventListener('mousedown', clique);
    window.addEventListener('scroll', remedir, true);
    window.addEventListener('resize', remedir);
    return () => {
      document.removeEventListener('mousedown', clique);
      window.removeEventListener('scroll', remedir, true);
      window.removeEventListener('resize', remedir);
    };
  }, [aberto, medir]);

  // Desabilitar com a lista aberta a deixaria presa na tela.
  useEffect(() => { if (desabilitado) setAberto(false); }, [desabilitado]);

  /**
   * Mantem a opcao marcada visivel dentro da lista.
   *
   * NAO usar scrollIntoView: ele rola TODOS os ancestrais rolaveis, inclusive
   * a pagina — abrir a lista fazia o conteudo da tela pular. Aqui mexemos
   * apenas no scrollTop da propria lista.
   */
  useEffect(() => {
    if (!aberto || !lista.current) return;
    const caixa = lista.current;
    const alvo = caixa.children[marcado];
    if (!alvo) return;
    const topo = alvo.offsetTop;
    const base = topo + alvo.offsetHeight;
    if (topo < caixa.scrollTop) caixa.scrollTop = topo;
    else if (base > caixa.scrollTop + caixa.clientHeight) caixa.scrollTop = base - caixa.clientHeight;
  }, [marcado, aberto]);

  function escolher(i) {
    const opcao = opcoes[i];
    if (!opcao) return;
    aoMudar(opcao.valor);
    setAberto(false);
  }

  function porDigitacao(tecla) {
    const agora = Date.now();
    // Mais de 700ms entre teclas: comeca uma busca nova, nao continua a anterior.
    busca.current.texto = agora - busca.current.quando > 700 ? tecla : busca.current.texto + tecla;
    busca.current.quando = agora;
    const alvo = busca.current.texto.toLowerCase();
    const i = opcoes.findIndex((o) => String(o.rotulo).toLowerCase().startsWith(alvo));
    if (i >= 0) {
      if (aberto) setMarcado(i);
      else escolher(i);
    }
  }

  function aoTeclar(e) {
    if (desabilitado) return;
    const { key } = e;

    if (!aberto) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        e.preventDefault();
        setAberto(true);
        return;
      }
      if (key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) porDigitacao(key);
      return;
    }

    switch (key) {
      case 'ArrowDown':
        e.preventDefault();
        setMarcado((m) => Math.min(m + 1, opcoes.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setMarcado((m) => Math.max(m - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setMarcado(0);
        break;
      case 'End':
        e.preventDefault();
        setMarcado(opcoes.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        escolher(marcado);
        break;
      case 'Escape':
        e.preventDefault();
        setAberto(false);
        break;
      case 'Tab':
        setAberto(false);
        break;
      default:
        if (key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) porDigitacao(key);
    }
  }

  return (
    <div className={`selecao ${aberto ? 'aberta' : ''}`} ref={wrap}>
      <button
        type="button"
        id={idBase}
        ref={botao}
        className="selecao-botao"
        onClick={() => !desabilitado && setAberto((a) => !a)}
        onKeyDown={aoTeclar}
        disabled={desabilitado}
        role="combobox"
        aria-controls={`${idBase}-lista`}
        aria-expanded={aberto}
        aria-haspopup="listbox"
        aria-activedescendant={aberto && opcoes[marcado] ? `${idBase}-op-${marcado}` : undefined}
        aria-label={rotuloAria}
      >
        <span className="selecao-texto">{escolhida ? escolhida.rotulo : vazio}</span>
        <svg className="selecao-seta" viewBox="0 0 16 16" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6.5l4 4 4-4" />
        </svg>
      </button>

      {aberto && posicao && createPortal(
        <ul
          className="selecao-lista"
          id={`${idBase}-lista`}
          role="listbox"
          ref={lista}
          tabIndex={-1}
          style={{
            left: posicao.esquerda,
            minWidth: posicao.largura,
            maxHeight: posicao.alturaDisponivel,
            ...(posicao.topo !== undefined ? { top: posicao.topo } : { bottom: posicao.base }),
          }}
        >
          {opcoes.map((o, i) => (
            <li
              key={String(o.valor)}
              id={`${idBase}-op-${i}`}
              role="option"
              aria-selected={i === indiceAtual}
              className={`selecao-opcao ${i === marcado ? 'marcada' : ''} ${i === indiceAtual ? 'escolhida' : ''}`}
              onMouseEnter={() => setMarcado(i)}
              onMouseDown={(e) => e.preventDefault()} /* nao tira o foco do botao */
              onClick={() => escolher(i)}
            >
              <span title={o.rotulo}>{o.rotulo}</span>
              {i === indiceAtual && (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 8.5l3.5 3.5L13 5" />
                </svg>
              )}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
