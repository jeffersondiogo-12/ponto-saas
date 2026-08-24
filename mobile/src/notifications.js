import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * IMPORTANTE: os campos deste handler foram conferidos direto no pacote
 * expo-notifications instalado (0.32.17, via Expo SDK 54) - `shouldShowAlert`
 * está depreciado nesta versão, substituído por `shouldShowBanner`/
 * `shouldShowList` (os dois obrigatórios). Se você atualizar o SDK do Expo
 * no futuro, vale conferir de novo (`node_modules/expo-notifications/
 * build/Notifications.types.d.ts`) antes de assumir que isto continua igual.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Pede permissão, obtém o token de push do Expo e registra no backend.
 * Retorna null (sem lançar erro) em qualquer caso em que não dá pra
 * prosseguir - simulador/emulador não tem push, permissão negada, etc -
 * porque a ausência de notificação não deveria impedir o resto do app de
 * funcionar.
 *
 * PRÉ-REQUISITO: precisa de um projectId real do EAS
 * (`npx eas init` neste projeto, depois `extra.eas.projectId` no
 * app.json) - sem isso, getExpoPushTokenAsync não tem como saber para
 * qual projeto emitir o token.
 */
export async function registrarParaNotificacoes() {
  if (!Device.isDevice) {
    console.warn('Notificações push exigem um dispositivo físico (não funcionam em emulador/simulador).');
    return null;
  }

  const { status: statusAtual } = await Notifications.getPermissionsAsync();
  let status = statusAtual;
  if (status !== 'granted') {
    const resultado = await Notifications.requestPermissionsAsync();
    status = resultado.status;
  }
  if (status !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn(
      'Nenhum projectId do EAS configurado - rode "npx eas init" e adicione extra.eas.projectId no app.json antes de gerar builds reais.'
    );
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    await api.registrarPushToken(token, Platform.OS);
    return token;
  } catch (err) {
    console.warn('Falha ao obter/registrar o token de push:', err.message);
    return null;
  }
}
