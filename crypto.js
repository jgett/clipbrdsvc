//const sjcl = require('sjcl');
const sjcl = require('./libs/sjcl.js');

function Crypto() {}
module.exports = Crypto;

Crypto.HASH_LENGTH = 256;
Crypto.HASH_ITERATIONS = 1000;
Crypto.CIPHER_ALGO = 'aes';
Crypto.CIPHER_MODE = 'ccm';
Crypto.CIPHER_KEY_SIZE = 256;
Crypto.CIPHER_KEY_ITERATIONS = 1000;
Crypto.CIPHER_TAG_SIZE = 64;

Crypto.encrypt = function(key, plaintext) {
    var keyBytes = sjcl.codec.hex.toBits(key);
    var params = {
        cipher: Crypto.CIPHER_ALGO,
        mode: Crypto.CIPHER_MODE,
        ts: Crypto.CIPHER_TAG_SIZE,
        iv: sjcl.random.randomWords(3, 0)
    };

    var cipherjson = sjcl.json.encrypt(keyBytes, plaintext, params);
    var encrypted = sjcl.json.decode(cipherjson);

    return {
        iv: sjcl.codec.base64.fromBits(encrypted.iv),
        ct: sjcl.codec.base64.fromBits(encrypted.ct)
    };
};

Crypto.decrypt = function(key, iv, ciphertext) {
    var keyBytes = sjcl.codec.hex.toBits(key);
    var ivBytes = sjcl.codec.base64.toBits(iv);
    var ctBytes = sjcl.codec.base64.toBits(ciphertext);

    var encrypted = {
        iv: ivBytes,
        ct: ctBytes,
        cipher: Crypto.CIPHER_ALGO,
        mode: Crypto.CIPHER_MODE,
        ts: Crypto.CIPHER_TAG_SIZE
    };
    var cipherjson = sjcl.json.encode(encrypted);
    var plaintext = sjcl.json.decrypt(keyBytes, cipherjson);
    return plaintext;
};

Crypto.createKey = function(email, password) {
    var salt = 'secret:' + email + ':secret';
    var saltBytes = sjcl.codec.utf8String.toBits(salt);
    var passwordBytes = sjcl.codec.utf8String.toBits(password);

    var hash = sjcl.misc.pbkdf2(passwordBytes, saltBytes,
        Crypto.CIPHER_KEY_ITERATIONS,
        Crypto.CIPHER_KEY_SIZE,
        function(key) {
            return new sjcl.misc.hmac(key, sjcl.hash.sha1);
        }
    );
    return sjcl.codec.hex.fromBits(hash);
};

Crypto.createHash = function(email, password) {
    var salt = 'secret:' + email + ':secret';
    var saltBytes = sjcl.codec.utf8String.toBits(salt);
    var passwordBytes = sjcl.codec.utf8String.toBits(password);

    var hash = sjcl.misc.pbkdf2(passwordBytes, saltBytes,
        Crypto.HASH_ITERATIONS,
        Crypto.HASH_LENGTH,
        function(key) {
            return new sjcl.misc.hmac(key, sjcl.hash.sha1);
        }
    );
    return sjcl.codec.hex.fromBits(hash);
};