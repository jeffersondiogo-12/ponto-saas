import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { cores, raio, sombra } from '../theme';

export default function LoginScreen() {
  const [papel, setPapel] = useState('responsavel'); // 'responsavel' | 'professor'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [unidade, setUnidade] = useState('');
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const { loginResponsavel, loginProfessor } = useAuth();

  async function entrar() {
    setErro(null);
    setCarregando(true);
    try {
      if (papel === 'professor') {
        await loginProfessor(email, senha, unidade);
      } else {
        await loginResponsavel(email, senha);
      }
    } catch (err) {
      setErro(err.message || 'Não foi possível entrar.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={estilos.container}>
      <View style={estilos.brilho} />

      <View style={estilos.cabecalho}>
        <Text style={estilos.marca}>
          Ponte<Text style={{ color: cores.azul }}>·</Text>Escolar
        </Text>
        <Text style={estilos.subtitulo}>
          {papel === 'professor'
            ? 'Chamada, notas e observações da sua turma'
            : 'Acompanhe a chegada e a saída do seu filho'}
        </Text>
      </View>

      <View style={estilos.cartao}>
        <View style={estilos.seletor}>
          <TouchableOpacity
            style={[estilos.opcao, papel === 'responsavel' && estilos.opcaoAtiva]}
            onPress={() => setPapel('responsavel')}
          >
            <Text style={[estilos.opcaoTexto, papel === 'responsavel' && estilos.opcaoTextoAtivo]}>
              Responsável
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[estilos.opcao, papel === 'professor' && estilos.opcaoAtiva]}
            onPress={() => setPapel('professor')}
          >
            <Text style={[estilos.opcaoTexto, papel === 'professor' && estilos.opcaoTextoAtivo]}>
              Professor
            </Text>
          </TouchableOpacity>
        </View>

        {erro && (
          <View style={estilos.erroCaixa}>
            <Text style={estilos.erroTexto}>{erro}</Text>
          </View>
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
          <>
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
          </>
        )}

        <TouchableOpacity style={estilos.botao} onPress={entrar} disabled={carregando}>
          {carregando ? (
            <ActivityIndicator color={cores.claro} />
          ) : (
            <Text style={estilos.botaoTexto}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={estilos.rodape}>Dados protegidos · acesso liberado pela escola</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.ink, justifyContent: 'center', padding: 24 },
  brilho: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(15,98,254,0.28)',
  },
  cabecalho: { marginBottom: 22 },
  marca: { fontSize: 30, fontWeight: '800', color: cores.claro, letterSpacing: -0.5 },
  subtitulo: { fontSize: 14, color: cores.claroSuave, marginTop: 6, lineHeight: 20 },
  cartao: {
    backgroundColor: cores.surface,
    borderRadius: raio.lg,
    padding: 20,
    ...sombra.cartao,
  },
  seletor: {
    flexDirection: 'row',
    backgroundColor: cores.paper,
    borderRadius: raio.sm,
    padding: 4,
    marginBottom: 20,
  },
  opcao: { flex: 1, paddingVertical: 10, borderRadius: raio.sm - 2, alignItems: 'center' },
  opcaoAtiva: { backgroundColor: cores.azul },
  opcaoTexto: { color: cores.inkSoft, fontWeight: '700', fontSize: 13.5 },
  opcaoTextoAtivo: { color: cores.claro },
  rotulo: { color: cores.inkSoft, fontSize: 12.5, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: cores.paper,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: cores.ink,
    marginBottom: 14,
  },
  ajuda: { color: cores.inkSoft, fontSize: 12, marginTop: -8, marginBottom: 14, lineHeight: 17 },
  botao: {
    backgroundColor: cores.azul,
    borderRadius: raio.sm,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  botaoTexto: { color: cores.claro, fontWeight: '800', fontSize: 15 },
  erroCaixa: {
    backgroundColor: cores.vermelhoSoft,
    borderLeftWidth: 3,
    borderLeftColor: cores.vermelho,
    borderRadius: raio.sm,
    padding: 12,
    marginBottom: 16,
  },
  erroTexto: { color: cores.vermelho, fontSize: 13, fontWeight: '600' },
  rodape: { color: cores.claroSuave, fontSize: 11.5, textAlign: 'center', marginTop: 18 },
});

