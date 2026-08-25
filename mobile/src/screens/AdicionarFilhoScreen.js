import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api';
import { AparecerEm, PressaoAnimada } from '../components/Animacoes';
import { cores, raio, sombra } from '../theme';

function CampoAnimado({ rotulo, ...props }) {
  const foco = useRef(new Animated.Value(0)).current;

  const animar = (para) =>
    Animated.timing(foco, { toValue: para, duration: 180, useNativeDriver: false }).start();

  return (
    <View style={estilos.campo}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Animated.View
        style={[
          estilos.inputCaixa,
          {
            borderColor: foco.interpolate({ inputRange: [0, 1], outputRange: [cores.linha, cores.azul] }),
            backgroundColor: foco.interpolate({
              inputRange: [0, 1],
              outputRange: [cores.surfaceAlt, cores.azulSoft],
            }),
          },
        ]}
      >
        <TextInput
          style={estilos.input}
          placeholderTextColor={cores.inkSoft}
          onFocus={() => animar(1)}
          onBlur={() => animar(0)}
          {...props}
        />
      </Animated.View>
    </View>
  );
}

export default function AdicionarFilhoScreen({ navigation }) {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [matricula, setMatricula] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function adicionar() {
    setErro(null);
    setCarregando(true);
    try {
      const resultado = await api.vincularFilho({
        nome_completo: nome.trim(),
        cpf,
        matricula_aluno: matricula.trim(),
        parentesco: parentesco.trim() || null,
      });
      if (resultado._fila) {
        Alert.alert(
          'Salvo no aparelho',
          'Sem conexão agora — assim que a internet voltar, o vínculo é confirmado automaticamente.',
          [{ text: 'Entendi', onPress: () => navigation.goBack() }]
        );
      } else {
        navigation.goBack();
      }
    } catch (err) {
      setErro(err.message || 'Não foi possível adicionar este aluno.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.container} keyboardShouldPersistTaps="handled">
        <AparecerEm>
          <View style={estilos.selo}>
            <View style={estilos.seloPonto} />
            <Text style={estilos.seloTexto}>Vínculo com a escola</Text>
          </View>
          <Text style={estilos.titulo}>Confirme os dados do aluno</Text>
          <Text style={estilos.explicacao}>
            Use exatamente os dados cadastrados pela escola. Eles serão conferidos antes de liberar o
            acesso.
          </Text>
        </AparecerEm>

        {erro && (
          <AparecerEm deslocamento={8}>
            <View style={estilos.erroCaixa}>
              <Text style={estilos.erro}>{erro}</Text>
            </View>
          </AparecerEm>
        )}

        <AparecerEm atraso={100} style={estilos.cartao}>
          <CampoAnimado
            rotulo="Nome completo"
            placeholder="Nome do aluno"
            value={nome}
            onChangeText={setNome}
          />
          <CampoAnimado
            rotulo="CPF"
            placeholder="000.000.000-00"
            keyboardType="numeric"
            value={cpf}
            onChangeText={setCpf}
          />
          <CampoAnimado
            rotulo="Matrícula"
            placeholder="Número da matrícula"
            value={matricula}
            onChangeText={setMatricula}
          />
          <CampoAnimado
            rotulo="Parentesco (opcional)"
            placeholder="Mãe, pai, responsável..."
            value={parentesco}
            onChangeText={setParentesco}
          />

          <PressaoAnimada style={estilos.botao} onPress={adicionar} disabled={carregando}>
            {carregando ? (
              <ActivityIndicator color={cores.claro} />
            ) : (
              <Text style={estilos.botaoTexto}>Adicionar filho</Text>
            )}
          </PressaoAnimada>
        </AparecerEm>

        <AparecerEm atraso={200}>
          <Text style={estilos.rodape}>Os dados são conferidos pela secretaria da escola.</Text>
        </AparecerEm>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper },
  container: { flexGrow: 1, padding: 20, paddingTop: 28 },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: cores.verdeSoft,
    borderRadius: raio.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    gap: 7,
  },
  seloPonto: { width: 7, height: 7, borderRadius: 4, backgroundColor: cores.verde },
  seloTexto: { color: cores.verdeEscuro, fontSize: 11.5, fontWeight: '800' },
  titulo: { fontSize: 24, fontWeight: '800', color: cores.ink, marginBottom: 8, letterSpacing: -0.4 },
  explicacao: { color: cores.inkSoft, lineHeight: 20, marginBottom: 20, fontSize: 13.5 },
  cartao: {
    backgroundColor: cores.surface,
    borderRadius: raio.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: cores.linha,
    ...sombra.cartao,
  },
  campo: { marginBottom: 14 },
  rotulo: { color: cores.inkSoft, fontSize: 12.5, fontWeight: '700', marginBottom: 6 },
  inputCaixa: { borderWidth: 1.5, borderRadius: raio.sm },
  input: { paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: cores.ink },
  botao: {
    backgroundColor: cores.azul,
    borderRadius: raio.sm,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
    ...sombra.destaque,
  },
  botaoTexto: { color: cores.claro, fontWeight: '800', fontSize: 15 },
  erroCaixa: {
    backgroundColor: cores.vermelhoSoft,
    borderLeftWidth: 3,
    borderLeftColor: cores.vermelho,
    borderRadius: raio.sm,
    padding: 12,
    marginBottom: 14,
  },
  erro: { color: cores.vermelho, fontSize: 13, fontWeight: '600' },
  rodape: { color: cores.inkSoft, fontSize: 12, textAlign: 'center', marginTop: 18 },
});
