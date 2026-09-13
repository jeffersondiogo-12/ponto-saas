import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import BarraNavegacao from '../components/BarraNavegacao';
import { cores } from '../theme';

import InicioScreen from '../screens/InicioScreen';
import AgendaScreen from '../screens/AgendaScreen';
import ChamadaScreen from '../screens/ChamadaScreen';
import RelatoriosScreen from '../screens/RelatoriosScreen';
import SincronizacaoScreen from '../screens/SincronizacaoScreen';

// `icone` e o nome base do Ionicons (ver BarraNavegacao).
const ABAS = [
  { chave: 'inicio', rotulo: 'Início', icone: 'home', Tela: InicioScreen },
  { chave: 'agenda', rotulo: 'Agenda', icone: 'calendar', Tela: AgendaScreen },
  { chave: 'chamada', rotulo: 'Chamada', icone: 'checkmark-done', Tela: ChamadaScreen, central: true },
  { chave: 'relatorios', rotulo: 'Relatórios', icone: 'stats-chart', Tela: RelatoriosScreen },
  { chave: 'sincronizar', rotulo: 'Sincronizar', icone: 'sync', Tela: SincronizacaoScreen },
];

/**
 * Navegacao do professor: barra inferior com botao central de acao (chamada).
 * Troca de tela por estado local e repassa o `navigation` do stack para as
 * telas empilhadas (AlunoDetalhe, Notas, Observacoes...).
 */
export default function BarraInferior({ navigation, route }) {
  const [ativa, setAtiva] = useState(route?.params?.aba || 'inicio');
  const Atual = useMemo(() => ABAS.find((aba) => aba.chave === ativa)?.Tela || InicioScreen, [ativa]);

  const navegacao = useMemo(
    () => ({
      ...navigation,
      navigate: (destino, params) => {
        const aba = ABAS.find((item) => item.chave === String(destino).toLowerCase());
        if (aba) return setAtiva(aba.chave);
        return navigation.navigate(destino, params);
      },
      irParaAba: setAtiva,
    }),
    [navigation]
  );

  const central = ABAS.find((aba) => aba.central);

  return (
    <View style={estilos.tela}>
      <View style={estilos.conteudo}>
        <Atual navigation={navegacao} />
      </View>

      <BarraNavegacao
        itens={ABAS.filter((aba) => !aba.central).map((aba) => ({
          chave: aba.chave,
          rotulo: aba.rotulo,
          icone: aba.icone,
          ativo: aba.chave === ativa,
          onPress: () => setAtiva(aba.chave),
        }))}
        central={{
          rotulo: central.rotulo,
          icone: central.icone,
          ativo: central.chave === ativa,
          onPress: () => setAtiva(central.chave),
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper },
  conteudo: { flex: 1 },
});
