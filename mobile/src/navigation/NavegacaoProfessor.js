import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BarraInferior from './BarraInferior';
import NotasScreen from '../screens/NotasScreen';
import ObservacoesScreen from '../screens/ObservacoesScreen';
import AlunoDetalheScreen from '../screens/AlunoDetalheScreen';
import { cores } from '../theme';

const Stack = createNativeStackNavigator();

/**
 * Stack do professor: a barra inferior e a tela principal; Notas,
 * Observacoes e a ficha do aluno abrem por cima dela.
 */
export default function NavegacaoProfessor() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: cores.paper },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Professor" component={BarraInferior} />
      <Stack.Screen name="Notas" component={NotasScreen} />
      <Stack.Screen name="Observacoes" component={ObservacoesScreen} />
      <Stack.Screen name="AlunoDetalhe" component={AlunoDetalheScreen} />
    </Stack.Navigator>
  );
}
