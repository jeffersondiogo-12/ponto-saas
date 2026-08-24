import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { cores } from '../theme';

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
      <Text style={estilos.marca}>
        Ponto<Text style={{ color: cores.brass }}>·</Text>SaaS
      </Text>
      <Text style={estilos.subtitulo}>
        {papel === 'professor'
          ? 'Chamada, notas e observações da sua turma'
          : 'Acompanhe a chegada e saída do seu filho'}
      </Text>

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

      <TextInput
        style={estilos.input}
        placeholder="E-mail"
        placeholderTextColor="#9aa39c"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={estilos.input}
        placeholder="Senha"
        placeholderTextColor="#9aa39c"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={senha}
        onChangeText={setSenha}
      />
      {papel === 'professor' && (
        <TextInput
          style={estilos.input}
          placeholder="Nome ou CNPJ da empresa (ambiente)"
          placeholderTextColor="#9aa39c"
          autoCapitalize="none"
          value={unidade}
          onChangeText={setUnidade}
        />
      )}

      <TouchableOpacity style={estilos.botao} onPress={entrar} disabled={carregando}>
        {carregando ? <ActivityIndicator color="#fff" /> : <Text style={estilos.botaoTexto}>Entrar</Text>}
      </TouchableOpacity>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.ink, justifyContent: 'center', padding: 28 },
  marca: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 6 },
  subtitulo: { fontSize: 14, color: '#c9d0cb', marginBottom: 24 },
  seletor: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  opcao: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  opcaoAtiva: { backgroundColor: cores.brass },
  opcaoTexto: { color: '#c9d0cb', fontWeight: '600', fontSize: 13.5 },
  opcaoTextoAtivo: { color: '#fff' },
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
});