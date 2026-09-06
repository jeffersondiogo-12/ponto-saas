import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { itensVisiveis, useCelular } from '../utils/navegacao';

/**
 * Icones em SVG inline. Sao 9 icones de traco simples — nao vale puxar uma
 * biblioteca de icones (~50kB+) para isso, e assim eles herdam currentColor
 * e acompanham o estado do item da dock sem CSS extra.
 */
const svg = (d, extra = null) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p) => <path key={p} d={p} />)}
    {extra}
  </svg>
);

const ICONES = {
  visao: () => svg(['M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z']),
  unidades: () => svg(['M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 9h3a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3']),
  turmas: () => svg(['M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87'], <>
    <circle cx="9.5" cy="7" r="3.2" /><path d="M16.5 3.3a3.2 3.2 0 0 1 0 7.4" />
  </>),
  alunos: () => svg(['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'], <circle cx="12" cy="7" r="3.6" />),
  funcionarios: () => svg(['M3 7h18v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M8 15h3M15 12h2'], <circle cx="9.5" cy="12" r="1.8" />),
  dispositivos: () => svg(['M12 8v4l2.5 1.5'], <circle cx="12" cy="12" r="8.4" />),
  usuarios: () => svg(['M12 3l7 3v5.5c0 4.2-2.9 7.6-7 8.5-4.1-.9-7-4.3-7-8.5V6zM9.3 11.8l1.9 1.9 3.6-3.7']),
  relatorios: () => svg(['M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M9 12h6M9 16h4']),
  auditoria: () => svg(['M4 5h16M4 12h10M4 19h6', 'M20.5 19.5L18 17'], <circle cx="16" cy="15" r="3.2" />),
  gestao: () => svg(['M3 20h18M6 20V11M11 20V6M16 20v-7M21 20V9']),
  professor: () => svg(['M3 4h18v11H3zM12 15v5M8 20h8M8 11l2.5-3 2 2.2L16 6.5']),
  avisos: () => svg(['M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 9.5a4 4 0 0 1 0 5M7 14v4']),
  permissoes: () => svg(['M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4M12 15v2']),
  sair: () => svg(['M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9']),
};

function ItemDock({ para, icone, rotulo, ativo }) {
  const Icone = ICONES[icone];
  return (
    <Link to={para} className={`dock-item ${ativo ? 'ativo' : ''}`} data-rotulo={rotulo} aria-label={rotulo}>
      <Icone />
      {/* Visivel so no celular. No computador o rotulo aparece ao passar o
          mouse, pelo `::after`; em tela de toque nao existe hover, e ali o
          menu tem no maximo quatro itens — o texto cabe. */}
      <span className="dock-rotulo">{rotulo}</span>
    </Link>
  );
}

/**
 * `empresaNome` era uma prop que NENHUMA pagina passava, entao a barra do topo
 * dizia "Nenhuma unidade selecionada" para sempre — mesmo com a unidade
 * escolhida no login. A informacao ja estava no contexto o tempo todo; a prop
 * continua aceita so para nao quebrar chamada antiga, mas o contexto e a
 * fonte de verdade.
 */
export default function Layout({ children, empresaNome }) {
  const { usuario, logout, filialSelecionada, empresaSelecionada, pode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  function sair() {
    logout();
    navigate('/login');
  }

  const ehAtivo = (caminho) => location.pathname.startsWith(caminho);

  /**
   * O menu decide por `pode(recurso, acao)`, nao por papel: a matriz mora no
   * banco, entao ligar ou desligar um acesso virou UPDATE, sem deploy nem
   * mudanca aqui.
   *
   * `ehEscola` continua como filtro ADICIONAL, e nao substitui a permissao:
   * turma e aluno so existem em unidade do tipo escola, entao mostrar esses
   * itens numa unidade "empresa" levaria a uma tela sempre vazia. Permissao
   * responde "voce pode?"; o tipo da unidade responde "faz sentido aqui?".
   */
  const ehEscola = filialSelecionada && filialSelecionada.tipo === 'escola';

  /**
   * As condicoes de cada item vivem em `utils/navegacao.js`, junto com a lista
   * do celular — assim o menu reduzido nao vira uma segunda copia das mesmas
   * regras. No celular a lista tambem muda de ordem: ela segue a do papel, e o
   * primeiro item e onde a pessoa cai ao entrar.
   */
  const celular = useCelular();
  const itens = itensVisiveis({ usuario, pode, filialSelecionada, ehEscola }, celular);

  return (
    <div className="shell">
      <aside className="dock" aria-label="Navegação principal">
        <Link to="/dashboard" className="dock-marca" aria-label="Ponte Escolar — ir para a visão geral">
          <img src="/ponte-escolar.png" alt="" />
        </Link>

        {/* Relatorios nao esta na lista: a porta de entrada e a secao
            "Relatorios" do Dashboard. A rota /relatorios continua valendo. */}
        <nav className="dock-grupo">
          {itens.map((item) => (
            <ItemDock
              key={item.para}
              para={item.para}
              icone={item.icone}
              rotulo={item.rotulo}
              ativo={ehAtivo(item.para)}
            />
          ))}
        </nav>

        <button type="button" className="dock-item dock-sair" onClick={sair} data-rotulo="Sair" aria-label="Sair">
          <ICONES.sair />
        </button>
      </aside>

      <div className="main">
        <div className="barra-topo">
          <span className="unidade-atual">
            {filialSelecionada?.nome || empresaNome || empresaSelecionada?.nome || 'Nenhuma unidade selecionada'}
            {filialSelecionada?.nome && empresaSelecionada?.nome && (
              <span className="unidade-empresa"> · {empresaSelecionada.nome}</span>
            )}
          </span>
          <span className="quem">{usuario?.nome}{usuario?.papel ? ` · ${usuario.papel}` : ''}</span>
        </div>
        <div className="conteudo">{children}</div>
      </div>
    </div>
  );
}
