import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import ProfessorLoginScreen from './src/screens/ProfessorLoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfessorHomeScreen from './src/screens/ProfessorHomeScreen';
import ProfessorTurmaChamadaScreen from './src/screens/ProfessorTurmaChamadaScreen';
import AlunoDetalheScreen from './src/screens/AlunoDetalheScreen';
import { registrarParaNotificacoes } from './src/notifications';
import { cores } from './src/theme';

const Stack = createNativeStackNavigator();

function Navegacao() {
  const { responsavel, professor, tipoSessao, carregandoSessao } = useAuth();

  useEffect(() => {
    if (responsavel) {
      registrarParaNotificacoes();
    }
  }, [responsavel]);

  if (carregandoSessao) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: cores.ink }, headerTintColor: '#fff' }}>
        {tipoSessao === 'professor' && professor ? (
          <>
            <Stack.Screen name="ProfessorHome" component={ProfessorHomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ProfessorTurmaChamada" component={ProfessorTurmaChamadaScreen} options={{ title: 'Chamada da turma' }} />
          </>
        ) : responsavel ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AlunoDetalhe" component={AlunoDetalheScreen} options={{ title: '' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ProfessorLogin" component={ProfessorLoginScreen} options={{ title: 'Login do professor' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Navegacao />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
