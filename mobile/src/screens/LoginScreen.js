import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { cores } from '../theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState('responsavel');
  const [unidade, setUnidade] = useState('');
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const { login } = useAuth();

  async function entrar() {
    setErro(null);
    setCarregando(true);
    try {
      await login(email, senha, tipo, unidade);
    } catch (err) {
      setErro(err.message || 'Não foi possível entrar.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={estilos.container}>
      <Text style={estilos.marca}>
        Ponto<Text style={{ color: cores.brass }}>·</Text>SaaS
      </Text>
      <Text style={estilos.subtitulo}>Acompanhe a chegada e saída do seu filho</Text>

      <View style={estilos.perfis}>
        <TouchableOpacity style={[estilos.perfil, tipo === 'responsavel' && estilos.perfilAtivo]} onPress={() => setTipo('responsavel')}><Text>Responsável</Text></TouchableOpacity>
        <TouchableOpacity style={[estilos.perfil, tipo === 'professor' && estilos.perfilAtivo]} onPress={() => setTipo('professor')}><Text>Professor</Text></TouchableOpacity>
      </View>

      {erro && (
        <View style={estilos.erroCaixa}>
          <Text style={estilos.erroTexto}>{erro}</Text>
        </View>
      )}

      <TextInput
        style={estilos.input}
        placeholder="E-mail"
        placeholderTextColor="#9aa39c"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {tipo === 'professor' && <TextInput style={estilos.input} placeholder="Nome da empresa ou escola" value={unidade} onChangeText={setUnidade} />}
      <TextInput
        style={estilos.input}
        placeholder="Senha"
        placeholderTextColor="#9aa39c"
        secureTextEntry
        value={senha}
        onChangeText={setSenha}
      />

      <TouchableOpacity style={estilos.botao} onPress={entrar} disabled={carregando}>
        {carregando ? <ActivityIndicator color="#fff" /> : <Text style={estilos.botaoTexto}>Entrar</Text>}
      </TouchableOpacity>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.ink, justifyContent: 'center', padding: 28 },
  marca: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 6 },
  subtitulo: { fontSize: 14, color: '#c9d0cb', marginBottom: 28 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  botao: { backgroundColor: cores.brass, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  botaoTexto: { color: '#fff', fontWeight: '600', fontSize: 15 },
  erroCaixa: { backgroundColor: '#3a2323', borderRadius: 8, padding: 12, marginBottom: 16 },
  erroTexto: { color: '#f0b4b4', fontSize: 13 },
  perfis: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  perfil: { flex: 1, backgroundColor: '#e8ebe8', padding: 12, borderRadius: 10, alignItems: 'center' },
  perfilAtivo: { backgroundColor: cores.brassSoft },
});
