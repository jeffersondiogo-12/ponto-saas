// Paleta Ponte Escolar — azul, verde, branco e cinza.
// Nomes antigos (brass, linha, sinal*) continuam existindo como apelidos,
// entao nenhuma tela antiga quebra ao importar.
export const cores = {
  // Base
  ink: '#062B4F', // azul profundo (titulos, textos fortes)
  inkSoft: '#61748C', // cinza-azulado (apoio)
  paper: '#F2F6FA', // fundo geral (cinza claro)
  surface: '#FFFFFF', // cartoes
  surfaceAlt: '#F7FAFC', // fundo de campos
  linha: '#DCE4EC', // bordas e divisores

  // Acento azul
  azul: '#0F62FE',
  azulEscuro: '#0A3F9E',
  azulSoft: '#E7F0FF',
  brass: '#0F62FE', // apelido antigo
  brassSoft: '#E7F0FF', // apelido antigo

  // Acento verde
  verde: '#12A374',
  verdeEscuro: '#0B7A56',
  verdeSoft: '#E2F7EF',

  // Sinais
  vermelho: '#D92D20',
  vermelhoSoft: '#FDECEA',
  sinalVerde: '#12A374',
  sinalVerdeSoft: '#E2F7EF',
  sinalVermelho: '#D92D20',
  sinalVermelhoSoft: '#FDECEA',

  // Texto sobre azul
  claro: '#FFFFFF',
  claroSuave: '#C6D8F2',
};

export const raio = { sm: 12, md: 16, lg: 22, pill: 999 };

export const espaco = { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 };

export const sombra = {
  cartao: {
    shadowColor: '#062B4F',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  destaque: {
    shadowColor: '#0F62FE',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
};

export const tipografia = {
  titulo: { fontSize: 24, fontWeight: '800', color: cores.ink, letterSpacing: -0.4 },
  secao: { fontSize: 16, fontWeight: '800', color: cores.ink },
  corpo: { fontSize: 14.5, color: cores.ink },
  apoio: { fontSize: 12.5, color: cores.inkSoft },
};
