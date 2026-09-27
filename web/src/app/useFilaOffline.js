import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { namespaceOffline } from '../api';
import { obterFila, ouvirFila } from './filaOffline';

/** As acoes guardadas da conta conectada, atualizadas a cada mudanca da fila. */
export function useFilaOffline() {
  const { usuario } = useAuth();
  const namespace = usuario ? namespaceOffline() : null;
  const [itens, setItens] = useState(() => obterFila(namespace));

  useEffect(() => {
    setItens(obterFila(namespace));
    return ouvirFila(namespace, setItens);
  }, [namespace]);

  return itens;
}

/**
 * O mesmo aviso do APK ao sair. Com acoes guardadas, diz quantas vao ser
 * apagadas deste aparelho.
 */
export function confirmarSaida(pendentes, credencial = 'do e-mail e da senha') {
  const mensagem = pendentes === 0
    ? `Para entrar de novo, você vai precisar ${credencial}.`
    : `${pendentes === 1 ? '1 ação ainda não enviada será apagada' : `${pendentes} ações ainda não enviadas serão apagadas`} deste aparelho. Toque em Sincronizar antes de sair para não perdê-las.`;
  return window.confirm(`Sair da conta?\n\n${mensagem}`);
}
