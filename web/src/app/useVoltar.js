import { useNavigate } from 'react-router-dom';

/**
 * Voltar da tela. No app instalado do iPhone nao existe o botao voltar do
 * navegador — sem isto, a pessoa fica presa na tela. Sem historia para tras
 * (a tela foi aberta direto), vai para o inicio.
 */
export function useVoltar() {
  const navigate = useNavigate();
  return () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/', { replace: true }));
}
