/**
 * Foto do aluno: o que o navegador faz ANTES de mandar a foto ao sistema
 * (`PUT /api/alunos/:id/foto`). A foto fica guardada, cifrada, e e ela que a
 * tela de Dispositivos manda ao equipamento facial.
 *
 * Le PNG ou JPG/JPEG, reduz para caber em 800x1280px (sem cortar nem esticar)
 * e regrava em JPEG. Regravar pelo canvas apaga os metadados: a foto do iPhone
 * traz a localizacao (GPS) de onde foi tirada, e isso nao vai junto com a
 * imagem de uma crianca (R8 do produto, melhor interesse).
 *
 * HEIC e TRAVADO, nao convertido (Samuel, 2026-10-21): o equipamento recusa, e
 * barrar aqui evita perder tempo descobrindo o erro no relogio. No iPhone o
 * seletor de fotos ja entrega JPEG quando o `accept` nao pede HEIC.
 */

export const ACEITA = '.png,.jpg,.jpeg,image/png,image/jpeg';

const LIMITE_BYTES = 20 * 1024 * 1024;
const LARGURA_MAXIMA = 800;
const ALTURA_MAXIMA = 1280;

// No Linux e no Windows o navegador costuma deixar o `type` do HEIC vazio:
// a extensao e o que sobra para reconhecer.
const ehHeic = (arquivo) => /image\/hei[cf]/.test(arquivo.type) || /\.(heic|heif)$/i.test(arquivo.name);
const ehPngOuJpeg = (arquivo) => ['image/png', 'image/jpeg'].includes(arquivo.type)
  || /\.(png|jpe?g)$/i.test(arquivo.name);

/** Devolve um JPEG (Blob) pronto para enviar, ou lanca com a mensagem para a tela. */
export async function prepararFoto(arquivo) {
  if (ehHeic(arquivo)) {
    throw new Error('Arquivo HEIC não é aceito pelo equipamento. Exporte a foto como JPG ou PNG e escolha de novo.');
  }
  if (!ehPngOuJpeg(arquivo)) {
    throw new Error('Formato não aceito. Use PNG, JPG ou JPEG.');
  }
  if (arquivo.size > LIMITE_BYTES) {
    throw new Error('A foto passa de 20 MB. Escolha um arquivo menor.');
  }

  let imagem;
  try {
    imagem = await createImageBitmap(arquivo);
  } catch {
    throw new Error('Não foi possível ler esta imagem. Tente outro arquivo.');
  }
  const escala = Math.min(1, LARGURA_MAXIMA / imagem.width, ALTURA_MAXIMA / imagem.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(imagem.width * escala);
  canvas.height = Math.round(imagem.height * escala);
  const contexto = canvas.getContext('2d');
  // PNG transparente viraria fundo preto no JPEG.
  contexto.fillStyle = '#fff';
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  imagem.close?.();

  return new Promise((resolver, rejeitar) => {
    canvas.toBlob(
      (blob) => (blob ? resolver(blob) : rejeitar(new Error('Não foi possível preparar a foto.'))),
      'image/jpeg',
      0.85,
    );
  });
}

/** JPEG -> "data:image/jpeg;base64,...": o servidor aceita com o prefixo. */
export function paraBase64(blob) {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(leitor.result);
    leitor.onerror = () => rejeitar(new Error('Não foi possível ler a foto preparada.'));
    leitor.readAsDataURL(blob);
  });
}

/**
 * O equipamento usa a matricula como ID: inteiro positivo, sem zero a esquerda
 * (mesma regra de `matriculaComoIdDispositivo`, em faceSync.service.js).
 */
export function matriculaServeDeId(matricula) {
  const valor = String(matricula || '').trim();
  return /^[1-9]\d*$/.test(valor) && Number.isSafeInteger(Number(valor));
}
