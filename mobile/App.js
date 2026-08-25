import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import AlunoDetalheScreen from './src/screens/AlunoDetalheScreen';
import AdicionarFilhoScreen from './src/screens/AdicionarFilhoScreen';
import ProfessorScreen from './src/screens/ProfessorScreen';
import { registrarParaNotificacoes } from './src/notifications';
import { conectarRealtime } from './src/realtime';
import { cores } from './src/theme';

const Stack = createNativeStackNavigator();

function Navegacao() {
  const { usuario, carregandoSessao } = useAuth();
  const ehResponsavel = usuario?.tipo === 'responsavel';
  const ehProfessor = usuario?.tipo === 'staff' && usuario?.papel === 'professor';

  // Push e o socket em tempo real so fazem sentido pro app dos pais hoje: e
  // a AlunoDetalheScreen quem escuta os eventos (nota.criada, observacao.criada
  // etc.) pra atualizar a tela sozinha. O professor ve o resultado das
  // proprias acoes na hora, sem precisar do socket.
  useEffect(() => {
    if (!ehResponsavel) return undefined;

    registrarParaNotificacoes();

    let ativo = true;
    let pararConexao = () => {};
    conectarRealtime().then((parar) => {
      if (ativo) pararConexao = parar;
      else parar();
    });

    return () => {
      ativo = false;
      pararConexao();
    };
  }, [ehResponsavel]);

  if (carregandoSessao) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: cores.ink }, headerTintColor: '#fff' }}>
        {ehResponsavel ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AlunoDetalhe" component={AlunoDetalheScreen} options={{ title: '' }} />
            <Stack.Screen
              name="AdicionarFilho"
              component={AdicionarFilhoScreen}
              options={{ title: 'Adicionar filho' }}
            />
          </>
        ) : ehProfessor ? (
          <Stack.Screen name="Professor" component={ProfessorScreen} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
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
