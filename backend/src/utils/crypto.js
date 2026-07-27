const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recomendado para GCM

/**
 * A senha do relogio de ponto (campo "SENHA" na tela de configuracao) precisa
 * ficar acessivel em texto puro para o backend conseguir autenticar no
 * dispositivo — mas NUNCA deve ficar em texto puro no banco. Por isso ela e
 * cifrada com AES-256-GCM usando uma chave que so existe como variavel de
 * ambiente (DEVICE_CREDENTIALS_KEY), nunca no codigo ou no banco.
 */
function getKey() {
  const hex = process.env.DEVICE_CREDENTIALS_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'DEVICE_CREDENTIALS_KEY ausente ou invalida. Gere uma com: openssl rand -hex 32'
    );
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(plainText) {
  if (plainText == null || plainText === '') return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Empacota iv + authTag + ciphertext em um unico base64 para guardar em uma coluna text.
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(payloadBase64) {
  if (!payloadBase64) return null;
  const raw = Buffer.from(payloadBase64, 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = raw.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
