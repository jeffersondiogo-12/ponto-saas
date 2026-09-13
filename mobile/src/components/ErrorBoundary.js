import { Component } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cores, raio } from '../theme';

// Classe, nao funcao: e o unico jeito de um Error Boundary existir em React.
// Fica de proposito sem depender de outro componente do app (Ui.js, Animacoes.js) -
// se o que quebrou foi algo compartilhado, o fallback ainda precisa renderizar.
export default class ErrorBoundary extends Component {
  state = { comErro: false };

  static getDerivedStateFromError() {
    return { comErro: true };
  }

  componentDidCatch(erro, info) {
    console.error('[ErrorBoundary]', erro, info?.componentStack);
  }

  reiniciar = () => this.setState({ comErro: false });

  render() {
    if (this.state.comErro) {
      return (
        <View style={estilos.tela}>
          <Text style={estilos.titulo}>Esta tela travou.</Text>
          <Text style={estilos.texto}>Toque para tentar de novo.</Text>
          <Pressable style={estilos.botao} onPress={this.reiniciar}>
            <Text style={estilos.botaoTexto}>Tentar de novo</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const estilos = StyleSheet.create({
  tela: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6, backgroundColor: cores.paper },
  titulo: { fontSize: 18, fontWeight: '800', color: cores.ink, textAlign: 'center' },
  texto: { fontSize: 14, color: cores.inkSoft, textAlign: 'center', marginBottom: 14 },
  botao: { backgroundColor: cores.azul, borderRadius: raio.lg, paddingHorizontal: 24, paddingVertical: 14 },
  botaoTexto: { color: cores.claro, fontWeight: '800', fontSize: 15 },
});
