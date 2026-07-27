import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import AlunoDetalheScreen from './src/screens/AlunoDetalheScreen';
import { registrarParaNotificacoes } from './src/notifications';
import { cores } from './src/theme';

const Stack = createNativeStackNavigator();

function Navegacao() {
  const { responsavel, carregandoSessao } = useAuth();

  // So registra push DEPOIS de logado - o token do Expo sozinho nao serve
  // pra nada sem saber a QUAL responsavel ele pertence no backend.
  useEffect(() => {
    if (responsavel) {
      registrarParaNotificacoes();
    }
  }, [responsavel]);

  if (carregandoSessao) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: cores.ink }, headerTintColor: '#fff' }}>
        {responsavel ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AlunoDetalhe" component={AlunoDetalheScreen} options={{ title: '' }} />
          </>
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
