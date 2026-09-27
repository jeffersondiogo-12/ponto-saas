import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { operaEmEscola, permitidoNoCelular, telaInicialNoCelular, useCaraApp } from './utils/navegacao';
import { RealtimeProvider } from './context/RealtimeContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DispositivosLista from './pages/DispositivosLista';
import DispositivoForm from './pages/DispositivoForm';
import UnidadesLista from './pages/UnidadesLista';
import UnidadeForm from './pages/UnidadeForm';
import SelecionarEmpresa from './pages/SelecionarEmpresa';
import FuncionariosLista from './pages/FuncionariosLista';
import AlunosLista from './pages/AlunosLista';
import AlunoForm from './pages/AlunoForm';
import UsuariosLista from './pages/UsuariosLista';
import UsuarioForm from './pages/UsuarioForm';
import TurmasLista from './pages/TurmasLista';
import TurmaForm from './pages/TurmaForm';
import TurmaDetalhe from './pages/TurmaDetalhe';
import Relatorios from './pages/Relatorios';
import Auditoria from './pages/Auditoria';
import ProfessorPainel from './pages/ProfessorPainel';
import GestorPainel from './pages/GestorPainel';
import AvisosLista from './pages/AvisosLista';
import AvisoForm from './pages/AvisoForm';
import PermissoesLista from './pages/PermissoesLista';
import SelecionarFilialModal from './components/SelecionarFilialModal';
import ErrorOverlay from './components/ErrorOverlay';
import AvisosRealtime from './components/AvisosRealtime';
import ErrorBoundary from './components/ErrorBoundary';
import CaraApp from './app/CaraApp';
import { perfilDaConta } from './app/perfil';
import DicaInstalar from './app/DicaInstalar';

/**
 * Papel sem lista de celular (professor e rh, hoje). Melhor dizer isso do que
 * jogar a pessoa numa tela qualquer e deixar ela procurando o que sumiu.
 */
function ForaDoCelular({ nome }) {
  return (
    <div className="tela-login">
      <div className="caixa-login">
        <div className="marca">
          <img src="/ponte-escolar.png" alt="Ponte Escolar" className="marca-logo" />
        </div>
        <p className="texto-apoio" style={{ textAlign: 'center' }}>
          {nome ? `${nome}, o` : 'O'} seu acesso ainda não está disponível pelo
          celular. Abra o Ponte Escolar em um computador para continuar.
        </p>
      </div>
    </div>
  );
}

function RotaProtegida({ children }) {
  const { usuario, pode, filialSelecionada } = useAuth();
  // Cara do app (celular ou instalado num aparelho de toque): a lista de telas
  // do celular vale tambem no iPad instalado, e nao so em tela estreita.
  const caraApp = useCaraApp();
  const { pathname } = useLocation();

  if (!usuario) return <Navigate to="/login" replace />;
  if (!caraApp) return children;

  /**
   * No celular a lista de telas do papel e restricao de verdade: nao basta
   * sumir do menu, o endereco direto tambem nao abre (decisao de 2026-09-06).
   * A checagem fica aqui, e nao em cada rota, para nao existir uma tela nova
   * que alguem esqueca de proteger.
   */
  if (permitidoNoCelular(usuario.papel, pathname)) return children;

  const ehEscola = operaEmEscola(usuario, filialSelecionada);
  const destino = telaInicialNoCelular({ usuario, pode, filialSelecionada, ehEscola });
  if (!destino) return <ForaDoCelular nome={usuario.nome?.split(' ')[0]} />;
  return <Navigate to={destino} replace />;
}

/** As rotas do web, como sempre foram. No computador nada aqui muda. */
function RotasWeb() {
  return (
    <>
      <SelecionarFilialModal />
      <ErrorOverlay />
      <AvisosRealtime />
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<RotaProtegida><Dashboard /></RotaProtegida>} />
      <Route path="/selecionar-empresa" element={<RotaProtegida><SelecionarEmpresa /></RotaProtegida>} />
      <Route path="/dispositivos" element={<RotaProtegida><DispositivosLista /></RotaProtegida>} />
      <Route path="/dispositivos/novo" element={<RotaProtegida><DispositivoForm /></RotaProtegida>} />
      <Route path="/dispositivos/:id/editar" element={<RotaProtegida><DispositivoForm /></RotaProtegida>} />
      <Route path="/unidades" element={<RotaProtegida><UnidadesLista /></RotaProtegida>} />
      <Route path="/unidades/nova" element={<RotaProtegida><UnidadeForm /></RotaProtegida>} />
      <Route path="/unidades/:id/editar" element={<RotaProtegida><UnidadeForm /></RotaProtegida>} />
      <Route path="/funcionarios" element={<RotaProtegida><FuncionariosLista /></RotaProtegida>} />
      <Route path="/alunos" element={<RotaProtegida><AlunosLista /></RotaProtegida>} />
      <Route path="/alunos/novo" element={<RotaProtegida><AlunoForm /></RotaProtegida>} />
      <Route path="/alunos/:id/editar" element={<RotaProtegida><AlunoForm /></RotaProtegida>} />
      <Route path="/usuarios" element={<RotaProtegida><UsuariosLista /></RotaProtegida>} />
      <Route path="/usuarios/novo" element={<RotaProtegida><UsuarioForm /></RotaProtegida>} />
      <Route path="/turmas" element={<RotaProtegida><TurmasLista /></RotaProtegida>} />
      <Route path="/turmas/nova" element={<RotaProtegida><TurmaForm /></RotaProtegida>} />
      <Route path="/turmas/:id" element={<RotaProtegida><TurmaDetalhe /></RotaProtegida>} />
      <Route path="/turmas/:id/editar" element={<RotaProtegida><TurmaForm /></RotaProtegida>} />
      <Route path="/avisos" element={<RotaProtegida><AvisosLista /></RotaProtegida>} />
      <Route path="/avisos/novo" element={<RotaProtegida><AvisoForm /></RotaProtegida>} />
      <Route path="/avisos/:id/editar" element={<RotaProtegida><AvisoForm /></RotaProtegida>} />
      <Route path="/relatorios" element={<RotaProtegida><Relatorios /></RotaProtegida>} />
      <Route path="/auditoria" element={<RotaProtegida><Auditoria /></RotaProtegida>} />
      <Route path="/permissoes" element={<RotaProtegida><PermissoesLista /></RotaProtegida>} />
      <Route path="/professor" element={<RotaProtegida><ProfessorPainel /></RotaProtegida>} />
      <Route path="/gestao" element={<RotaProtegida><GestorPainel /></RotaProtegida>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

/**
 * No celular, ou instalado num aparelho de toque, o sistema mostra a cara do
 * app (PWA); no computador, o web de sempre. Ver `useCaraApp`.
 *
 * Na cara do app, a gestao (admin, gestor, super_admin) usa as paginas do web
 * com a casca do app (`LayoutGestao`) e as cores do app: a classe `cara-gestao`
 * vai no <body> para alcancar tambem o que abre em portal (lista do <Selecao>,
 * modais). Responsavel, professor e o login vao para `CaraApp`.
 */
function Caras() {
  const caraApp = useCaraApp();
  const { usuario } = useAuth();
  const gestaoNoApp = caraApp && perfilDaConta(usuario) === 'gestao';

  useEffect(() => {
    document.body.classList.toggle('cara-gestao', gestaoNoApp);
  }, [gestaoNoApp]);

  if (!caraApp) return <RotasWeb />;
  if (gestaoNoApp) return <div className="cara-app"><RotasWeb /><DicaInstalar /></div>;
  return <CaraApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Caras />
          </ErrorBoundary>
        </BrowserRouter>
      </RealtimeProvider>
    </AuthProvider>
  );
}
