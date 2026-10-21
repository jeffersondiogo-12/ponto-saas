const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recomendado para GCM
const FACE_QUEUE_KEY_INFO = Buffer.from('ponto-saas:face-queue:v1', 'utf8');

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

function getFaceQueueKey() {
  // Deriva uma chave separada para biometria, sem reutilizar a chave AES das senhas dos equipamentos.
  return Buffer.from(
    crypto.hkdfSync('sha256', getKey(), Buffer.alloc(0), FACE_QUEUE_KEY_INFO, 32)
  );
}

function encryptWithKey(plainText, key) {
  if (plainText == null || plainText === '') return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Empacota iv + authTag + ciphertext em um unico base64 para guardar em uma coluna text.
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptWithKey(payloadBase64, key) {
  if (!payloadBase64) return null;
  const raw = Buffer.from(payloadBase64, 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = raw.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function encrypt(plainText) {
  return encryptWithKey(plainText, getKey());
}

function decrypt(payloadBase64) {
  return decryptWithKey(payloadBase64, getKey());
}

function encryptFaceQueueData(plainText) {
  return encryptWithKey(plainText, getFaceQueueKey());
}

function decryptFaceQueueData(payloadBase64) {
  return decryptWithKey(payloadBase64, getFaceQueueKey());
}

module.exports = { encrypt, decrypt, encryptFaceQueueData, decryptFaceQueueData };
