import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarraNavegacao } from '../Ui';
import Sincronizacao from '../Sincronizacao';
import InicioProfessor from './InicioProfessor';
import AgendaProfessor from './AgendaProfessor';
import ChamadaProfessor from './ChamadaProfessor';
import RelatoriosProfessor from './RelatoriosProfessor';

/**
 * As abas do professor, como a BarraInferior do APK: Inicio, Agenda,
 * Chamada (no meio), Relatorios e Sincronizar.
 *
 * As cinco telas ficam MONTADAS o tempo todo e so a ativa aparece — trocar de
 * aba no meio da chamada nao apaga o que ja foi marcado (M1 do APK). Pelo
 * mesmo motivo este componente continua montado, escondido, quando Notas,
 * Observacoes ou a ficha do aluno abrem por cima.
 *
 * A pagina rola na janela, que e uma so para as cinco: a posicao de cada aba
 * fica guardada e volta quando a aba volta.
 */
const ABAS = [
  { chave: 'inicio', caminho: '/', rotulo: 'Início', icone: 'home' },
  { chave: 'agenda', caminho: '/agenda', rotulo: 'Agenda', icone: 'calendar' },
  { chave: 'chamada', caminho: '/chamada', rotulo: 'Chamada', icone: 'checkmark-done' },
  { chave: 'relatorios', caminho: '/relatorios', rotulo: 'Relatórios', icone: 'stats-chart' },
  { chave: 'sincronizar', caminho: '/sincronizar', rotulo: 'Sincronizar', icone: 'sync' },
];

export default function AbasProfessor({ visivel, onSair }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const ativa = ABAS.find((aba) => aba.caminho === pathname) || ABAS[0];
  const rolagem = useRef({});

  // Guarda a rolagem da aba enquanto ela esta na tela.
  useEffect(() => {
    if (!visivel) return undefined;
    const guardar = () => { rolagem.current[ativa.chave] = window.scrollY; };
    window.addEventListener('scroll', guardar, { passive: true });
    return () => window.removeEventListener('scroll', guardar);
  }, [visivel, ativa.chave]);

  // Ao voltar para uma aba (ou das telas de cima), volta onde ela estava.
  useLayoutEffect(() => {
    if (visivel) window.scrollTo(0, rolagem.current[ativa.chave] || 0);
  }, [visivel, ativa.chave]);

  const itens = ABAS.filter((aba) => aba.chave !== 'chamada').map((aba) => ({
    chave: aba.chave,
    rotulo: aba.rotulo,
    icone: aba.icone,
    ativo: aba.chave === ativa.chave,
    onClick: () => navigate(aba.caminho),
  }));
  const chamada = ABAS.find((aba) => aba.chave === 'chamada');

  return (
    <div hidden={!visivel}>
      <div hidden={ativa.chave !== 'inicio'}><InicioProfessor onSair={onSair} /></div>
      <div hidden={ativa.chave !== 'agenda'}><AgendaProfessor /></div>
      <div hidden={ativa.chave !== 'chamada'}><ChamadaProfessor /></div>
      <div hidden={ativa.chave !== 'relatorios'}><RelatoriosProfessor /></div>
      <div hidden={ativa.chave !== 'sincronizar'}><Sincronizacao comoAba /></div>
      <BarraNavegacao
        itens={itens}
        central={{ rotulo: chamada.rotulo, icone: chamada.icone, onClick: () => navigate(chamada.caminho) }}
      />
    </div>
  );
}
