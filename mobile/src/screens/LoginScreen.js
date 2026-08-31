import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AparecerEm, PressaoAnimada } from '../components/Animacoes';
import { cores, raio, sombra } from '../theme';

export default function LoginScreen() {
  const [papel, setPapel] = useState('responsavel'); // 'responsavel' | 'professor'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [unidade, setUnidade] = useState('');
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [manterLogin, setManterLogin] = useState(true);
  const { loginResponsavel, loginProfessor } = useAuth();

  // Orbes de fundo em movimento lento.
  const orbe = useRef(new Animated.Value(0)).current;
  // Tremida da caixa de erro.
  const tremor = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(orbe, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(orbe, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    laco.start();
    return () => laco.stop();
  }, [orbe]);

  function sacudir() {
    tremor.setValue(0);
    Animated.sequence([
      Animated.timing(tremor, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(tremor, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(tremor, { toValue: 0.5, duration: 60, useNativeDriver: true }),
      Animated.timing(tremor, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function entrar() {
    setErro(null);
    setCarregando(true);
    try {
      if (papel === 'professor') {
        await loginProfessor(email, senha, unidade, manterLogin);
      } else {
        await loginResponsavel(email, senha, manterLogin);
      }
    } catch (err) {
      setErro(err.message || 'Não foi possível entrar.');
      sacudir();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View pointerEvents="none" style={estilos.orbeArea}>
        <View style={estilos.orbeAzulWrapper}>
          <Animated.View
            style={[
              estilos.orbeAzul,
              {
                transform: [
                  { translateY: orbe.interpolate({ inputRange: [0, 1], outputRange: [0, 26] }) },
                  { scale: orbe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
                ],
              },
            ]}
          />
        </View>
        <View style={estilos.orbeVerdeWrapper}>
          <Animated.View
            style={[
              estilos.orbeVerde,
              {
                transform: [
                  { translateY: orbe.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) },
                  { scale: orbe.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) },
                ],
              },
            ]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={estilos.conteudo}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AparecerEm style={estilos.cabecalho} deslocamento={20}>
          <View style={estilos.selo}>
            <View style={estilos.seloPonto} />
            <Text style={estilos.seloTexto}>Escola conectada</Text>
          </View>
          <Text style={estilos.marca}>
            Ponte<Text style={{ color: cores.verde }}>·</Text>Escolar
          </Text>
          <Text style={estilos.subtitulo}>
            {papel === 'professor'
              ? 'Chamada, notas e observações da sua turma'
              : 'Acompanhe a chegada e a saída do seu filho'}
          </Text>
        </AparecerEm>

        <AparecerEm style={estilos.cartao} atraso={120}>
          <View style={estilos.seletor}>
            <PressaoAnimada
              style={[estilos.opcao, papel === 'responsavel' ? estilos.opcaoAtivaResponsavel : estilos.opcaoInativa]}
              onPress={() => setPapel('responsavel')}
              escala={0.95}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[estilos.opcaoTexto, papel === 'responsavel' && estilos.opcaoTextoAtivo]}
              >
                Responsável
              </Text>
            </PressaoAnimada>
            <PressaoAnimada
              style={[estilos.opcao, papel === 'professor' ? estilos.opcaoAtivaProfessor : estilos.opcaoInativa]}
              onPress={() => setPapel('professor')}
              escala={0.95}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[estilos.opcaoTexto, papel === 'professor' && estilos.opcaoTextoAtivo]}
              >
                Professor
              </Text>
            </PressaoAnimada>
          </View>

          {erro && (
            <Animated.View
              style={[
                estilos.erroCaixa,
                {
                  transform: [
                    { translateX: tremor.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
                  ],
                },
              ]}
            >
              <Text style={estilos.erroTexto}>{erro}</Text>
            </Animated.View>
          )}

          <Text style={estilos.rotulo}>E-mail</Text>
          <TextInput
            style={estilos.input}
            placeholder="voce@escola.com"
            placeholderTextColor={cores.inkSoft}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={estilos.rotulo}>Senha</Text>
          <TextInput
            style={estilos.input}
            placeholder="••••••••"
            placeholderTextColor={cores.inkSoft}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={senha}
            onChangeText={setSenha}
          />

          {papel === 'professor' && (
            <AparecerEm deslocamento={10}>
              <Text style={estilos.rotulo}>Ambiente (empresa)</Text>
              <TextInput
                style={estilos.input}
                placeholder="Nome ou CNPJ da empresa"
                placeholderTextColor={cores.inkSoft}
                autoCapitalize="none"
                value={unidade}
                onChangeText={setUnidade}
              />
              <Text style={estilos.ajuda}>
                A empresa onde você trabalha. As escolas e filiais ficam dentro dela.
              </Text>
            </AparecerEm>
          )}

          <View style={estilos.manterLoginLinha}>
            <View style={estilos.manterLoginTexto}>
              <Text style={estilos.manterLoginTitulo}>Manter login salvo</Text>
              <Text style={estilos.manterLoginAjuda}>Reabrir o app sem digitar a senha</Text>
            </View>
            <Switch
              value={manterLogin}
              onValueChange={setManterLogin}
              trackColor={{ false: cores.linha, true: cores.verdeSoft }}
              thumbColor={manterLogin ? cores.verde : cores.inkSoft}
            />
          </View>

          <PressaoAnimada
            style={[estilos.botao, papel === 'professor' && estilos.botaoVerde]}
            onPress={entrar}
            disabled={carregando}
          >
            {carregando ? (
              <ActivityIndicator color={cores.claro} />
            ) : (
              <Text style={estilos.botaoTexto}>Entrar</Text>
            )}
          </PressaoAnimada>
        </AparecerEm>

        <AparecerEm atraso={240}>
          <Text style={estilos.rodape}>Dados protegidos · acesso liberado pela escola</Text>
        </AparecerEm>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.ink },
  conteudo: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 36 },
  orbeAzul: {
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(15,98,254,0.32)',
  },
  orbeVerde: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(18,163,116,0.22)',
  },
  cabecalho: { marginBottom: 22 },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: raio.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
    gap: 7,
  },
  seloPonto: { width: 7, height: 7, borderRadius: 4, backgroundColor: cores.verde },
  seloTexto: { color: cores.claroSuave, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  marca: { fontSize: 32, fontWeight: '800', color: cores.claro, letterSpacing: -0.8 },
  subtitulo: { fontSize: 14, color: cores.claroSuave, marginTop: 8, lineHeight: 20 },
  orbeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orbeAzulWrapper: {
    position: 'absolute',
    top: -130,
    right: -90,
  },
  orbeVerdeWrapper: {
    position: 'absolute',
    bottom: -140,
    left: -110,
  },
  cartao: {
    backgroundColor: cores.surface,
    borderRadius: raio.lg,
    padding: 22,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    ...sombra.cartao,
  },
  seletor: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: cores.paper,
    borderRadius: raio.md,
    padding: 6,
    minHeight: 64,
    marginBottom: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  opcao: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: raio.sm,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  opcaoInativa: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  opcaoAtivaResponsavel: {
    backgroundColor: cores.azul,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: cores.azul,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  opcaoAtivaProfessor: {
    backgroundColor: cores.verde,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: cores.verde,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  opcaoTexto: {
    color: cores.inkSoft,
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  opcaoTextoAtivo: { color: cores.claro },
  rotulo: { color: cores.inkSoft, fontSize: 12.5, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: cores.surfaceAlt,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.sm,
    paddingHorizontal: 14,
    minHeight: 50,
    paddingVertical: 12,
    fontSize: 15,
    color: cores.ink,
    marginBottom: 14,
  },
  ajuda: { color: cores.inkSoft, fontSize: 12, marginTop: -8, marginBottom: 14, lineHeight: 17 },
  manterLoginLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  manterLoginTexto: { flex: 1, paddingRight: 12 },
  manterLoginTitulo: { color: cores.ink, fontSize: 13.5, fontWeight: '700' },
  manterLoginAjuda: { color: cores.inkSoft, fontSize: 11.5, marginTop: 3 },
  botao: {
    backgroundColor: cores.azul,
    borderRadius: raio.sm,
    minHeight: 54,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    ...sombra.destaque,
  },
  botaoVerde: { backgroundColor: cores.verde, shadowColor: cores.verde },
  botaoTexto: { color: cores.claro, fontWeight: '800', fontSize: 15 },
  erroCaixa: {
    backgroundColor: cores.vermelhoSoft,
    borderLeftWidth: 3,
    borderLeftColor: cores.vermelho,
    borderRadius: raio.sm,
    padding: 12,
    marginBottom: 16,
    minHeight: 48,
  },
  erroTexto: { color: cores.vermelho, fontSize: 13, fontWeight: '600' },
  rodape: { color: cores.claroSuave, fontSize: 11.5, textAlign: 'center', marginTop: 20 },
});
