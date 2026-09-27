import './app.css';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { processarFila } from '../api';
import { CabecalhoHome, Cartao } from './Ui';
import { perfilDaConta } from './perfil';
import { confirmarSaida, useFilaOffline } from './useFilaOffline';
import LoginApp from './LoginApp';
import DicaInstalar from './DicaInstalar';
import { cancelarInscricao } from './notificacoesPush';
import Sincronizacao from './Sincronizacao';
import HomeResponsavel from './responsavel/HomeResponsavel';
import FichaFilho from './responsavel/FichaFilho';
import AvisoTela from './responsavel/AvisoTela';
import AdicionarFilho from './responsavel/AdicionarFilho';
import AbasProfessor from './professor/AbasProfessor';
import NotasProfessor from './professor/NotasProfessor';
import ObservacoesProfessor from './professor/ObservacoesProfessor';
import FichaAlunoProfessor from './professor/FichaAlunoProfessor';

/**
 * Raiz da cara do app (PWA). O `App.jsx` escolhe entre esta e as rotas do web
 * pelo `useCaraApp()` e pelo perfil (ver `perfil.js`).
 *
 * Sem sessao, o login do APK. Com sessao:
 * - responsavel → telas do responsavel (#63), em `responsavel/`;
 * - professor → telas do professor (#69), em `professor/`;
 * - rh e qualquer outro papel → aviso de que o acesso e pelo computador.
 * A gestao nao passa por aqui: usa as paginas do web, com a casca do app
 * (`LayoutGestao`, #64).
 */

export default function CaraApp() {
  const { usuario, logout } = useAuth();
  // Todas contam, inclusive as recusadas: sair apaga todas, como no APK.
  const pendentes = useFilaOffline().length;

  /**
   * Sincronizacao da fila offline, como no APK: ao entrar, quando a conexao
   * volta e quando o app volta a aparecer na tela. Com o app fechado nada
   * roda — sincronizar em segundo plano so existe no Android, e o iPhone e o
   * motivo deste PWA.
   *
   * `persist()` pede ao navegador para nao apagar os dados do site quando
   * faltar espaco — o que a fila guarda ainda nao chegou ao servidor.
   */
  useEffect(() => {
    if (!usuario) return undefined;
    navigator.storage?.persist?.().catch(() => {});
    processarFila();
    const aoVoltar = () => { if (document.visibilityState === 'visible') processarFila(); };
    window.addEventListener('online', processarFila);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.removeEventListener('online', processarFila);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [usuario]);

  async function sair() {
    const responsavel = usuario?.tipo === 'responsavel';
    if (!confirmarSaida(pendentes, responsavel ? 'do e-mail e da senha' : 'do seu usuário e da senha')) return;
    // So quem escolhe sair perde a notificacao: sessao expirada mantem a inscricao.
    if (responsavel) await cancelarInscricao();
    logout();
  }

  return (
    <div className="cara-app">
      {usuario ? <Entrou usuario={usuario} onSair={sair} /> : <LoginApp />}
      <DicaInstalar />
    </div>
  );
}

function Entrou({ usuario, onSair }) {
  const perfil = perfilDaConta(usuario);
  const primeiroNome = usuario.nome?.trim().split(/\s+/)[0];

  // As telas do responsavel, como a pilha do APK: Home, ficha, aviso,
  // adicionar filho e sincronizar. Endereco desconhecido volta para a Home.
  if (perfil === 'responsavel') {
    return (
      <Routes>
        <Route path="/" element={<HomeResponsavel onSair={onSair} />} />
        <Route path="/filho/:alunoId" element={<FichaFilho />} />
        <Route path="/filho/:alunoId/aviso/:avisoId" element={<AvisoTela />} />
        <Route path="/adicionar-filho" element={<AdicionarFilho />} />
        <Route path="/sincronizar" element={<Sincronizacao />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (perfil === 'professor') return <TelasProfessor onSair={onSair} />;

  return (
    <main className="app-tela">
      <CabecalhoHome titulo={primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'} nome={usuario.nome} onSair={onSair} />
      <Cartao atraso={90}>
        <p className="app-texto">O seu acesso ainda não está disponível pelo celular.</p>
        <p className="app-texto-apoio">Abra o Ponte Escolar em um computador para continuar.</p>
      </Cartao>
    </main>
  );
}

/**
 * Professor: as abas ficam montadas por baixo; Notas, Observacoes e a ficha do
 * aluno abrem por cima, como a pilha do APK. Endereco desconhecido volta ao
 * Inicio.
 */
const TELAS_POR_CIMA = /^\/(notas|observacoes|aluno\/[^/]+\/[^/]+)$/;
const CAMINHOS_ABAS = ['/', '/agenda', '/chamada', '/relatorios', '/sincronizar'];

function TelasProfessor({ onSair }) {
  const { pathname } = useLocation();
  const porCima = TELAS_POR_CIMA.test(pathname);
  if (!porCima && !CAMINHOS_ABAS.includes(pathname)) return <Navigate to="/" replace />;
  return (
    <>
      <AbasProfessor visivel={!porCima} onSair={onSair} />
      <Routes>
        <Route path="/notas" element={<NotasProfessor />} />
        <Route path="/observacoes" element={<ObservacoesProfessor />} />
        <Route path="/aluno/:turmaId/:alunoId" element={<FichaAlunoProfessor />} />
        <Route path="*" element={null} />
      </Routes>
    </>
  );
}
