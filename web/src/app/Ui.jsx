import Icone from './Icone';
import { useVoltar } from './useVoltar';
import { formatarDataHora } from './datas';

/**
 * Componentes da cara do app: espelho de mobile/src/components/Ui.js e
 * BarraNavegacao.js, com os mesmos nomes e as mesmas props. Quem conhece a
 * tela do app encontra aqui o mesmo bloco — e uma mudanca de design no app
 * tem um lugar so para ser repetida no PWA.
 *
 * Aqui entra so o que ja tem tela usando.
 */

/** Entrada suave: `atraso` escalona itens de lista, como no app. */
function aparecer(atraso = 0, deslocamento) {
  return {
    '--app-atraso': `${atraso}ms`,
    ...(deslocamento !== undefined && { '--app-deslocamento': `${deslocamento}px` }),
  };
}

function iniciaisDoNome(nome = '') {
  return nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('');
}

/** Cabecalho das telas iniciais de professor e responsavel. */
export function CabecalhoHome({ papel, titulo, subtitulo, nome, onSair }) {
  const iniciais = iniciaisDoNome(nome);
  return (
    <header className="app-aparecer">
      <div className="app-home-marca-linha">
        <div className="app-home-marca">
          <img src="/ponte-escolar.png" alt="Ponte Escolar" className="app-home-logo" />
          <span className="app-home-marca-texto" aria-hidden="true">PONTE · ESCOLAR</span>
        </div>
        <div className="app-home-conta">
          {iniciais ? <span className="app-avatar" aria-hidden="true">{iniciais}</span> : null}
          {onSair ? (
            <button type="button" className="app-sair app-pressao" onClick={onSair}>Sair</button>
          ) : null}
        </div>
      </div>
      {papel ? <p className="app-home-papel">{papel}</p> : null}
      <h1 className="app-home-titulo">{titulo}</h1>
      {subtitulo ? <p className="app-home-subtitulo">{subtitulo}</p> : null}
    </header>
  );
}

export function Cartao({ children, atraso = 0 }) {
  return (
    <section className="app-cartao app-aparecer" style={aparecer(atraso)}>
      {children}
    </section>
  );
}

/**
 * Ficha de numero. Sem `onClick` e so leitura (a Home do responsavel); com
 * ele vira botao (a Home do professor, como no APK).
 */
export function Ficha({ rotulo, valor, destaque, atraso = 0, onClick }) {
  const classe = `app-ficha app-aparecer${destaque ? ' app-ficha-destaque' : ''}${onClick ? ' app-pressao' : ''}`;
  const conteudo = (
    <>
      <span className="app-ficha-valor">{valor}</span>
      <span className="app-ficha-rotulo">{rotulo}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={classe} style={aparecer(atraso, 10)} onClick={onClick}>{conteudo}</button>
  ) : (
    <div className={classe} style={aparecer(atraso, 10)}>{conteudo}</div>
  );
}

/** Cabecalho das telas de formulario (Chamada, Notas, Observacoes). */
export function Cabecalho({ rotulo, titulo, subtitulo, acao }) {
  return (
    <header className="app-cabecalho app-aparecer">
      <div className="app-cabecalho-textos">
        <p className="app-cabecalho-rotulo">{rotulo}</p>
        <h1 className="app-cabecalho-titulo">{titulo}</h1>
        {subtitulo ? <p className="app-cabecalho-subtitulo">{subtitulo}</p> : null}
      </div>
      {acao || null}
    </header>
  );
}

const DIAS_LABEL = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
const formatarDias = (dias) => (Array.isArray(dias) ? dias.map((dia) => DIAS_LABEL[dia] ?? dia).join(' ') : '');
const formatarHora = (hora) => (typeof hora === 'string' ? hora.slice(0, 5) : '');
const resumoHorarioColegio = (horarios) => (Array.isArray(horarios) ? horarios
  .map((h) => `${DIAS_LABEL[h.dia_semana] || h.dia_semana} ${formatarHora(h.hora_entrada)}-${formatarHora(h.hora_saida)}`)
  .join(' · ') : '');

/** Trilho horizontal de turmas: Chamada, Notas e Observacoes. */
export function SeletorTurma({ turmas, turmaAtiva, aoSelecionar }) {
  if (!turmas?.length) return null;
  return (
    <div>
      <p className="app-secao app-secao-turma">Turma</p>
      <div className="app-trilho" role="radiogroup" aria-label="Turma">
        {turmas.map((item, indice) => {
          const ativa = turmaAtiva?.atribuicao_id === item.atribuicao_id;
          const horarioAula = formatarDias(item.dias_semana) || item.hora_inicio
            ? `${formatarDias(item.dias_semana)} ${formatarHora(item.hora_inicio)}-${formatarHora(item.hora_fim)}`.trim()
            : '';
          const horarioColegio = resumoHorarioColegio(item.horarios_turma);
          return (
            <button
              key={item.atribuicao_id}
              type="button"
              role="radio"
              aria-checked={ativa}
              className={`app-chip app-pressao app-aparecer${ativa ? ' ativo' : ''}`}
              style={aparecer(indice * 60, 10)}
              onClick={() => aoSelecionar(item)}
            >
              <span className="app-chip-nome">{item.nome}</span>
              <span className="app-chip-detalhe">{item.materia}</span>
              {horarioAula ? <span className="app-chip-detalhe">{horarioAula}</span> : null}
              {horarioColegio ? <span className="app-chip-detalhe">Colégio: {horarioColegio}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Opcoes em chips (aluno, bimestre, tipo de avaliacao). `itens`: texto ou { chave, rotulo }. */
export function Opcoes({ itens, valor, aoEscolher, rotulo }) {
  return (
    <div className="app-opcoes" role="radiogroup" aria-label={rotulo}>
      {itens.map((item) => {
        const chave = item.chave ?? item;
        const ativo = chave === valor;
        return (
          <button
            key={chave}
            type="button"
            role="radio"
            aria-checked={ativo}
            className={`app-opcao app-pressao${ativo ? ' ativa' : ''}`}
            onClick={() => aoEscolher(chave)}
          >
            {item.rotulo ?? item}
          </button>
        );
      })}
    </div>
  );
}

export function BotaoGrande({ texto, onClick, secundario, desabilitado, tipo = 'button' }) {
  return (
    <button
      type={tipo}
      className={`app-botao app-pressao${secundario ? ' app-botao-secundario' : ''}`}
      onClick={onClick}
      disabled={desabilitado}
    >
      {texto}
    </button>
  );
}

/**
 * Faixa unica de estado: sem conexao e acoes guardadas na mesma linha, e o
 * "sem conexao" diz de quando sao os dados na tela. `offlineEm` e o `_cacheEm`
 * da resposta; sem ele, a faixa aparece sem a data.
 */
export function FaixaEstado({ offlineEm, offline, pendentes = 0, onSincronizar }) {
  const semConexao = Boolean(offlineEm || offline);
  if (!semConexao && !pendentes) return null;

  const partes = [];
  if (semConexao) {
    const quando = offlineEm ? formatarDataHora(offlineEm) : '';
    partes.push(quando ? `Sem conexão · dados de ${quando}` : 'Sem conexão · mostrando o que está salvo no aparelho');
  }
  if (pendentes) {
    partes.push(pendentes === 1 ? '1 ação aguardando envio' : `${pendentes} ações aguardando envio`);
  }

  return (
    <div className="app-faixa" role="status">
      <span className="app-faixa-linha">
        <span className="app-faixa-ponto" aria-hidden="true" />
        <span className="app-faixa-texto">{partes.join(' · ')}</span>
      </span>
      {onSincronizar ? (
        <button type="button" className="app-faixa-acao" onClick={onSincronizar}>Sincronizar</button>
      ) : null}
    </div>
  );
}

/** O cabecalho de pilha do app: seta de voltar e titulo. `escuro` sobre fundo azul-escuro. */
export function BarraTopo({ titulo, escuro }) {
  const voltar = useVoltar();
  return (
    <div className={`app-topo${escuro ? ' app-topo-escuro' : ''}`}>
      <button type="button" className="app-topo-voltar" onClick={voltar} aria-label="Voltar">
        <Icone nome="chevron-back" />
      </button>
      {titulo ? <span className="app-topo-titulo">{titulo}</span> : null}
    </div>
  );
}

export function Carregando() {
  return <span className="app-carregando" role="status" aria-label="Carregando" />;
}

/** Aviso de erro ou de sucesso. Sem texto, nao ocupa espaco. */
export function Aviso({ tipo, texto }) {
  if (!texto) return null;
  const erro = tipo === 'erro';
  return (
    <div
      className={`app-aviso app-aparecer ${erro ? 'app-aviso-erro' : 'app-aviso-ok'}`}
      style={aparecer(0, 8)}
      role={erro ? 'alert' : 'status'}
    >
      {texto}
    </div>
  );
}

/**
 * Barra inferior, a mesma do app.
 *
 * itens:   [{ chave, rotulo, icone, ativo, desabilitado, onClick }] — `icone` e o
 *          nome base do Ionicons; ativo usa o cheio, inativo o "-outline".
 * central: { rotulo, icone, onClick } — acao principal, no meio dos itens.
 */
export function BarraNavegacao({ itens, central }) {
  const meio = Math.ceil(itens.length / 2);
  return (
    <nav className="app-barra" aria-label="Navegação principal">
      {itens.slice(0, meio).map((item) => <Item key={item.chave} {...item} />)}
      {central ? <Central {...central} /> : null}
      {itens.slice(meio).map((item) => <Item key={item.chave} {...item} />)}
    </nav>
  );
}

function Item({ rotulo, icone, ativo, desabilitado, onClick }) {
  return (
    <button
      type="button"
      className={`app-barra-item${ativo ? ' ativo' : ''}`}
      onClick={onClick}
      disabled={desabilitado}
      aria-current={ativo ? 'page' : undefined}
    >
      <Icone nome={ativo ? icone : `${icone}-outline`} />
      <span className="app-barra-rotulo">{rotulo}</span>
    </button>
  );
}

function Central({ rotulo, icone, onClick }) {
  return (
    <button type="button" className="app-barra-item app-barra-central" onClick={onClick}>
      <span className="app-barra-circulo"><Icone nome={icone} tamanho={28} /></span>
      <span className="app-barra-rotulo">{rotulo}</span>
    </button>
  );
}
