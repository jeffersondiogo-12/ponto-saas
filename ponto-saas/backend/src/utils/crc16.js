/**
 * CRC-16/KERMIT (== CRC-16/CCITT-TRUE), exigido pelo leiaute oficial do AFD
 * para REP-A e REP-P (poli 0x1021 refletido, valor inicial 0x0000, sem XOR final).
 *
 * Valor de referencia oficial: crc16Kermit("123456789") === 0x2189
 * (bate com o exemplo citado na documentacao do leiaute do AFD).
 */
function crc16Kermit(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'latin1');
  let crc = 0x0000;

  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0x8408;
      } else {
        crc = crc >> 1;
      }
    }
  }

  return crc & 0xffff;
}

function crc16KermitHex(input) {
  return crc16Kermit(input).toString(16).padStart(4, '0');
}

module.exports = { crc16Kermit, crc16KermitHex };
