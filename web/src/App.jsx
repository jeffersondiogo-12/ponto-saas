import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import Relatorios from './pages/Relatorios';
import ProfessorPainel from './pages/ProfessorPainel';
import SelecionarFilialModal from './components/SelecionarFilialModal';
import ErrorOverlay from './components/ErrorOverlay';
import ErrorBoundary from './components/ErrorBoundary';

function RotaProtegida({ children }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <SelecionarFilialModal />
          <ErrorOverlay />
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
          <Route path="/usuarios" element={<RotaProtegida><UsuariosLista /></RotaProtegida>} />
          <Route path="/usuarios/novo" element={<RotaProtegida><UsuarioForm /></RotaProtegida>} />
          <Route path="/turmas" element={<RotaProtegida><TurmasLista /></RotaProtegida>} />
          <Route path="/relatorios" element={<RotaProtegida><Relatorios /></RotaProtegida>} />
          <Route path="/professor" element={<RotaProtegida><ProfessorPainel /></RotaProtegida>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
