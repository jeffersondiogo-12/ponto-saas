// Componentes de animacao reutilizaveis (API Animated nativa - sem libs extras).
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View, StyleSheet } from 'react-native';
import { cores, raio } from '../theme';

/**
 * Entrada suave: fade + subida. `atraso` escalona itens de lista.
 */
export function AparecerEm({ atraso = 0, deslocamento = 14, style, children }) {
  const progresso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progresso, {
      toValue: 1,
      duration: 420,
      delay: atraso,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progresso, atraso]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progresso,
          transform: [
            {
              translateY: progresso.interpolate({
                inputRange: [0, 1],
                outputRange: [deslocamento, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Toque com "afundada" elastica - da sensacao fisica ao botao/cartao.
 */
export function PressaoAnimada({ onPress, disabled, escala = 0.97, style, children }) {
  const valor = useRef(new Animated.Value(1)).current;

  const animar = (para) =>
    Animated.spring(valor, {
      toValue: para,
      friction: 6,
      tension: 180,
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animar(escala)}
      onPressOut={() => animar(1)}
    >
      <Animated.View style={[style, { transform: [{ scale: valor }], opacity: disabled ? 0.6 : 1 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Pulso continuo - usado em avisos de "offline" e "aguardando conexao".
 */
export function Pulsar({ ativo = true, style, children }) {
  const valor = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ativo) return undefined;
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(valor, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(valor, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    laco.start();
    return () => laco.stop();
  }, [ativo, valor]);

  return (
    <Animated.View
      style={[style, { opacity: valor.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) }]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Barra fina animada que sublinha a aba ativa.
 */
export function IndicadorAba({ quantidade, indiceAtivo, cor = cores.azul }) {
    const posicao = useRef(new Animated.Value(indiceAtivo)).current;
    const largura = useRef(0);

    useEffect(() => {
    Animated.spring(posicao, {
        toValue: indiceAtivo,
        friction: 9,
        tension: 90,
      useNativeDriver: true,
    }).start();
  }, [indiceAtivo, posicao]);

  return (
    <View
      style={estilos.trilho}
      onLayout={(evento) => {
        largura.current = evento.nativeEvent.layout.width;
      }}
    >
      <Animated.View
        style={[
          estilos.barra,
          {
            backgroundColor: cor,
            width: `${100 / quantidade}%`,
            transform: [
              {
                translateX: posicao.interpolate({
                  inputRange: [0, Math.max(quantidade - 1, 1)],
                  outputRange: [0, (largura.current * (quantidade - 1)) / quantidade],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  trilho: { height: 3, borderRadius: raio.pill, overflow: 'hidden', backgroundColor: 'transparent' },
  barra: { height: 3, borderRadius: raio.pill },
});
