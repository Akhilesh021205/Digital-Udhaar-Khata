const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.key');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.key');

function initializeKeys() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
  }
}

// Initialize keys on load
initializeKeys();

const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');

/**
 * Sign a message using the server's private key
 * @param {string} message 
 * @returns {string} Hex signature
 */
function sign(message) {
  const signer = crypto.createSign('sha256');
  signer.update(message);
  signer.end();
  return signer.sign(privateKey, 'hex');
}

/**
 * Verify a signature using a public key
 * @param {string} message 
 * @param {string} signature Hex signature
 * @param {string} pubKey Optional public key to use (defaults to server's public key)
 * @returns {boolean}
 */
function verify(message, signature, pubKey) {
  try {
    const verifier = crypto.createVerify('sha256');
    verifier.update(message);
    verifier.end();
    return verifier.verify(pubKey || publicKey, signature, 'hex');
  } catch (err) {
    return false;
  }
}

module.exports = {
  getPrivateKey: () => privateKey,
  getPublicKey: () => publicKey,
  sign,
  verify,
};
