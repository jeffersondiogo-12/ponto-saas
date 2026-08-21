const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

/**
 * Mesma convencao de armazenamento local ja usada por afd.service.js
 * (storage/<algo>/, fora do controle de versao - ver .gitignore). Fotos de
 * batida entram aqui em vez de num bucket externo porque este projeto ainda
 * nao tem nenhuma integracao de storage em nuvem configurada; se isso mudar
 * (S3, GCS etc), so este arquivo precisa ser trocado - quem chama
 * salvarFotoBatida() so se importa com receber uma URL de volta.
 */
const DIRETORIO_BASE = path.join(__dirname, '..', '..', '..', 'storage', 'fotos_ponto');

/**
 * O campo `image` do protocolo Evo Facial vem em Base64 puro (ver PDF,
 * secao 1.2 e legenda de backupnum "50: Foto"). Alguns firmwares/gateways
 * por ai afora mandam com prefixo data-URI (data:image/jpeg;base64,...) -
 * aceitamos os dois formatos para nao quebrar por uma diferenca de firmware.
 */
function extrairBase64Puro(valor) {
  if (!valor || typeof valor !== 'string') return null;
  const virgula = valor.indexOf(',');
  if (virgula >= 0 && valor.slice(0, virgula).toLowerCase().includes('base64')) {
    return valor.slice(virgula + 1);
  }
  return valor;
}

/**
 * Salva a foto de uma batida em disco e devolve a URL relativa (servida via
 * GET /api/ponto/registros/:id/foto, autenticada e escopada por empresa -
 * nunca express.static direto, porque a pasta storage/ tambem guarda AFD,
 * que e dado de fiscalizacao trabalhista e nao pode ficar publico).
 * Retorna null se `imagemBase64` vier vazio (nem toda batida tem foto - so
 * quando o modo de verificacao inclui reconhecimento facial em tempo real).
 */
async function salvarFotoBatida(dispositivoId, imagemBase64) {
  const dados = extrairBase64Puro(imagemBase64);
  if (!dados) return null;

  const buffer = Buffer.from(dados, 'base64');
  if (buffer.length === 0) return null;

  const diretorio = path.join(DIRETORIO_BASE, dispositivoId);
  await fs.mkdir(diretorio, { recursive: true });

  const nomeArquivo = `${Date.now()}-${crypto.randomUUID()}.jpg`;
  await fs.writeFile(path.join(diretorio, nomeArquivo), buffer);

  return `fotos_ponto/${dispositivoId}/${nomeArquivo}`;
}

/** Resolve a URL relativa salva em `foto_url` de volta pro caminho real em disco. */
function caminhoAbsoluto(fotoUrlRelativa) {
  return path.join(DIRETORIO_BASE, '..', fotoUrlRelativa);
}

module.exports = { salvarFotoBatida, caminhoAbsoluto };
