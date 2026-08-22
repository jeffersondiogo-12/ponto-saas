import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children, empresaNome }) {
  const { usuario, logout } = useAuth();
  const { filialSelecionada } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  function sair() {
    logout();
    navigate('/login');
  }

  const ativo = (caminho) => (location.pathname.startsWith(caminho) ? 'ativo' : '');

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="marca">
          Ponto<span className="ponto-brass">·</span>SaaS
        </div>
        <nav className="nav">
          <Link to="/dashboard" className={ativo('/dashboard')}>Dashboard</Link>
          {usuario?.papel === 'professor' && (
            <Link to="/professor" className={ativo('/professor')}>Minhas turmas</Link>
          )}
          {(usuario?.papel === 'admin' || usuario?.papel === 'super_admin') && (
            <Link to="/unidades" className={ativo('/unidades')}>Unidades</Link>
          )}
          <Link to="/dispositivos" className={ativo('/dispositivos')}>Dispositivos</Link>
          {(!filialSelecionada || filialSelecionada.tipo === 'empresa') && (
            <Link to="/funcionarios" className={ativo('/funcionarios')}>Funcionários</Link>
          )}

          {usuario?.papel !== 'professor' && filialSelecionada && filialSelecionada.tipo === 'escola' && (
            <Link to="/turmas" className={ativo('/turmas')}>Turmas</Link>
          )}

          {usuario?.papel !== 'professor' && filialSelecionada && filialSelecionada.tipo === 'escola' && (
            <Link to="/alunos" className={ativo('/alunos')}>Alunos</Link>
          )}

          {usuario?.papel !== 'professor' && filialSelecionada && filialSelecionada.tipo === 'escola' && (
            <Link to="/usuarios" className={ativo('/usuarios')}>Usuários</Link>
          )}

          <Link to="/relatorios" className={ativo('/relatorios')}>Relatórios</Link>
        </nav>
      </aside>
      <div className="main">
        <div className="topbar">
          <div className="empresa-nome">{empresaNome || 'Nenhuma unidade selecionada'}</div>
          <div className="usuario">
            <span>{usuario?.nome}</span>
            <button className="link" onClick={sair} type="button">Sair</button>
          </div>
        </div>
        <div className="conteudo">{children}</div>
      </div>
    </div>
  );
}
