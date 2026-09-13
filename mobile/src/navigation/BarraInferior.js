import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BarraNavegacao from '../components/BarraNavegacao';
import { cores } from '../theme';

import InicioScreen from '../screens/InicioScreen';
import AgendaScreen from '../screens/AgendaScreen';
import ChamadaScreen from '../screens/ChamadaScreen';
import RelatoriosScreen from '../screens/RelatoriosScreen';
import SincronizacaoScreen from '../screens/SincronizacaoScreen';

// `icone` e o nome base do Ionicons (ver BarraNavegacao).
const ICONES = { inicio: 'home', agenda: 'calendar', chamada: 'checkmark-done', relatorios: 'stats-chart', sincronizar: 'sync' };
const ROTULOS = { inicio: 'Início', agenda: 'Agenda', chamada: 'Chamada', relatorios: 'Relatórios', sincronizar: 'Sincronizar' };

const Tab = createBottomTabNavigator();

function TabBarPersonalizada({ state, navigation }) {
  const rotaAtiva = state.routes[state.index].name;
  const itens = state.routes
    .filter((rota) => rota.name !== 'chamada')
    .map((rota) => ({
      chave: rota.name,
      rotulo: ROTULOS[rota.name],
      icone: ICONES[rota.name],
      ativo: rota.name === rotaAtiva,
      onPress: () => navigation.navigate(rota.name),
    }));

  return (
    <BarraNavegacao
      itens={itens}
      central={{
        rotulo: ROTULOS.chamada,
        icone: ICONES.chamada,
        ativo: rotaAtiva === 'chamada',
        onPress: () => navigation.navigate('chamada'),
      }}
    />
  );
}

/**
 * Navegacao do professor: abas de verdade (@react-navigation/bottom-tabs),
 * cada uma com sua propria BarraNavegacao como tabBar. Ao contrario da troca
 * por estado que a versao anterior usava, a tela que sai de foco continua
 * montada — trocar de aba durante a chamada nao apaga o progresso (M1).
 */
export default function BarraInferior({ route }) {
  return (
    <Tab.Navigator
      initialRouteName={route?.params?.aba || 'inicio'}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: cores.paper } }}
      tabBar={(props) => <TabBarPersonalizada {...props} />}
    >
      <Tab.Screen name="inicio" component={InicioScreen} />
      <Tab.Screen name="agenda" component={AgendaScreen} />
      <Tab.Screen name="chamada" component={ChamadaScreen} />
      <Tab.Screen name="relatorios" component={RelatoriosScreen} />
      <Tab.Screen name="sincronizar" component={SincronizacaoScreen} />
    </Tab.Navigator>
  );
}
