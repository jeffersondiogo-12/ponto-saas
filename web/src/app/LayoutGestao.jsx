import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { itensVisiveis, operaEmEscola } from '../utils/navegacao';
import { BarraNavegacao } from './Ui';
import { confirmarSaida } from './useFilaOffline';

/**
 * Casca da gestao na cara do app (#64). As paginas sao as MESMAS do web —
 * mesmas funcoes, mesmas regras, as telas que o celular ja libera
 * (`TELAS_CELULAR`) —; muda so a volta delas: no lugar da dock e da barra do
 * topo, o cabecalho e a barra de baixo do app. As cores e formas das paginas
 * vem do bloco `body.cara-gestao` em app.css.
 */
const ICONES = { visao: 'grid', dispositivos: 'time', unidades: 'business', turmas: 'people', alunos: 'school', avisos: 'megaphone' };
const PAPEL = { admin: 'ADMINISTRAÇÃO', gestor: 'GESTÃO', super_admin: 'SUPER ADMIN' };

function iniciais(nome = '') {
  return nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0].toUpperCase()).join('');
}

export default function LayoutGestao({ children, empresaNome }) {
  const { usuario, logout, filialSelecionada, empresaSelecionada, pode } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const ehEscola = operaEmEscola(usuario, filialSelecionada);
  const itens = itensVisiveis({ usuario, pode, filialSelecionada, ehEscola }, true).map((item) => ({
    chave: item.para,
    rotulo: item.rotulo,
    icone: ICONES[item.icone] || 'grid',
    ativo: pathname.startsWith(item.para),
    onClick: () => navigate(item.para),
  }));
  const unidade = filialSelecionada?.nome || empresaNome || empresaSelecionada?.nome;

  function sair() {
    if (confirmarSaida(0, 'do seu usuário e da senha')) logout();
  }

  return (
    <>
      <main className="app-tela app-gestao-tela">
        <header className="app-aparecer">
          <div className="app-home-marca-linha">
            <div className="app-home-marca">
              <img src="/ponte-escolar.png" alt="Ponte Escolar" className="app-home-logo" />
              <span className="app-home-marca-texto" aria-hidden="true">PONTE · ESCOLAR</span>
            </div>
            <div className="app-home-conta">
              <span className="app-avatar" aria-hidden="true">{iniciais(usuario?.nome)}</span>
              <button type="button" className="app-sair app-pressao" onClick={sair}>Sair</button>
            </div>
          </div>
          <p className="app-home-papel">{PAPEL[usuario?.papel] || 'GESTÃO'}</p>
          {unidade ? <p className="app-gestao-unidade">{unidade}</p> : null}
        </header>
        <div className="app-gestao-conteudo">{children}</div>
      </main>
      {itens.length ? <BarraNavegacao itens={itens} /> : null}
    </>
  );
}
