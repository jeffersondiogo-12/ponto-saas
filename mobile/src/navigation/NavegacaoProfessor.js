import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BarraInferior from './BarraInferior';
import NotasScreen from '../screens/NotasScreen';
import ObservacoesScreen from '../screens/ObservacoesScreen';
import FichaAlunoProfessorScreen from '../screens/FichaAlunoProfessorScreen';
import { cores } from '../theme';

const Stack = createNativeStackNavigator();

/**
 * Stack do professor: a barra inferior e a tela principal; Notas,
 * Observacoes e a ficha do aluno abrem por cima dela.
 *
 * A ficha aqui e a do professor (MOB-008). A `AlunoDetalheScreen` nao entra
 * neste stack: ela consulta rotas /api/responsaveis/* e daria 403 com token
 * de professor.
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
      <Stack.Screen name="ProfessorAbas" component={BarraInferior} />
      <Stack.Screen name="Notas" component={NotasScreen} />
      <Stack.Screen name="Observacoes" component={ObservacoesScreen} />
      <Stack.Screen name="FichaAluno" component={FichaAlunoProfessorScreen} />
    </Stack.Navigator>
  );
}
