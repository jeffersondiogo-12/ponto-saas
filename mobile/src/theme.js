//Paleta Ponte Escolar — azul profundo, branco, cinza-azulado e verde.
// Nomes antigos (brass, linha, sinal*) foram mantidos como apelidos para que
// nenhuma tela quebre; o valor por tras deles mudou para a nova paleta.
export const cores = {
  // Base
  ink: '#06203F', // azul quase preto (titulos, barras)
  inkSoft: '#5B6B80', // cinza-azulado (textos de apoio)
  paper: '#F4F7FA', // fundo geral
  surface: '#FFFFFF', // cartoes
  linha: '#D7DEE5', // bordas e divisores

  // Acento azul
  azul: '#0F62FE',
  azulEscuro: '#0A45B0',
  azulSoft: '#E8F0FE',
  brass: '#0F62FE', // apelido antigo
  brassSoft: '#E8F0FE', // apelido antigo

  // Sinais
  verde: '#17A673',
  verdeSoft: '#E3F7EF',
  vermelho: '#D92D20',
  vermelhoSoft: '#FDECEA',
  sinalVerde: '#17A673',
  sinalVerdeSoft: '#E3F7EF',
  sinalVermelho: '#D92D20',
  sinalVermelhoSoft: '#FDECEA',

  // Texto sobre azul
  claro: '#FFFFFF',
  claroSuave: '#C3D3EA',
};

export const raio = { sm: 10, md: 14, lg: 18, pill: 999 };

export const sombra = {
  cartao: {
    shadowColor: '#06203F',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};

