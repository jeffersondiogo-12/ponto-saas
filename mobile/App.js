import { useEffect } from 'react';
import { AppState } from 'react-native';
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
import { processarFilaOffline } from './src/api';
import { cores } from './src/theme';

const Stack = createNativeStackNavigator();

function Navegacao() {
  const { usuario, carregandoSessao } = useAuth();
  const ehResponsavel = usuario?.tipo === 'responsavel';
  const ehProfessor = usuario?.tipo === 'staff' && usuario?.papel === 'professor';

  // O socket em tempo real agora vale pros dois papeis: o responsavel usa
  // pra atualizar a tela do filho sozinha (nota/observacao/presenca/aviso
  // novos), o professor usa pra saber na hora se o gestor atribuiu (ou
  // tirou) uma turma - sem isso, so veria na proxima vez que abrisse o app.
  // Push continua so pro responsavel (professor esta com o app aberto,
  // trabalhando ativamente - nao faz sentido notificar quem ja esta usando).
  useEffect(() => {
    if (!ehResponsavel && !ehProfessor) return undefined;

    if (ehResponsavel) registrarParaNotificacoes();

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
  }, [ehResponsavel, ehProfessor]);

  // Fila offline (chamada, nota, observação, filho adicionado...): tenta
  // reenviar sempre que o app volta pro primeiro plano, que e o momento mais
  // provavel da conexão ter voltado (rede.js/api.js tambem tenta depois de
  // qualquer chamada bem sucedida, mas isso so acontece se alguma tela
  // pedir dados nesse meio tempo - o AppState cobre quem so reabriu o app).
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') processarFilaOffline();
    });
    return () => assinatura.remove();
  }, []);

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
