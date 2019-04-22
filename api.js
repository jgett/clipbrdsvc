const EventEmitter = require('events');
const https = require('https');
const querystring = require('querystring');
const io = require('socket.io-client');
const btoa = require('btoa');
const settings = require('./settings.js');
const Crypto = require('./crypto.js');

class API extends EventEmitter {
    constructor(options) {
        super();
        
        this.endpoint = options.endpoint;
        this.deviceId = options.deviceId;
        this.maxLength = options.maxLength;

        this.sio = null;
        this.enabled = false;
        this.connecting = false;

        this.credentials = {};
        this.credentials.email = options.email;
        this.credentials.hash = options.hash;
        
        // alias the emit function
        this.trigger = this.emit;
    }
}

module.exports = API;

var Proto = API.prototype;

Proto.post = function(url, data, cb) {
    var postData = querystring.stringify(data);
    
    var options = {
        hostname: this.endpoint.replace('https://', '').replace('http://', ''),
        port: 443,
        path: url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };
    
    if (arguments.length == 4) {
        cb = arguments[3];
        options.headers['Authorization'] = 'Basic ' + this.getAuthPayload();
    }
    
    var post = https.request(options, (res) => {
        if (res.statusCode === 0) {
            cb(new Error('connection_problems'), res);
        } else if (res.statusCode !== 200) {
            cb(new Error(errorify(res)), res);
        } else {
            cb(null, res);
        }
    });
    
    post.write(postData);
    post.end();
};

Proto.setAuthCredentials = function(email, hash) {
    this.credentials.email = email;
    this.credentials.hash = hash;
};

Proto.clearAuthCredentials = function() {
    delete this.credentials.email;
    delete this.credentials.hash;
};

Proto.hasAuthCredentials = function() {
    return !!(this.credentials.email && this.credentials.hash);
};

Proto.checkAuthCredentials = function() {
    if (!this.hasAuthCredentials()) {
        this.trigger('err', new Error('no_credentials'));
        return false;
    }
    return true;
};

Proto.getAuthPayload = function() {
    var email = this.credentials.email;
    var hash = this.credentials.hash;
    return btoa(email + ':' + hash);
};

Proto.signup = function(onsignup, onerror) {
    if (!this.checkAuthCredentials()) return;

    DEBUG('superagent signup start ' + JSON.stringify(this.credentials));

    var self = this;

    this.post('/signup', this.credentials, function(err, res) {
        DEBUG('superagent signup status ' + res.status);
        if (err) {
            onerror && onerror(err);
            self.trigger('err', err);
            return;
        }
        onsignup && onsignup();
        self.trigger('signup');
    });
};

Proto.signout = function() {
    this.disable();
    this.clearAuthCredentials();
    this.trigger('signout');
};

Proto.changeHash = function(newHash, onchange, onerror) {
    var self = this;
    var data = {hash: newHash};

    this.post('/change-hash', data, true, function(err, res) {
        if (err) return onerror && onerror(err);
        self.credentials.hash = newHash;
        onchange && onchange();
    });
};

Proto.resetHash = function(data, onsuccess, onerror) {
    this.post('/reset-hash', data, function(err, res) {
        if (err) return onerror && onerror(err);
        onsuccess && onsuccess();
    });
};

Proto.forgotHash = function(email, onsuccess, onerror) {
    this.post('/forgot-hash', {email: email}, function(err, res) {
        if (err) return onerror && onerror(err);
        onsuccess && onsuccess();
    });
};

Proto.sync = function(clipboard) {
    if (!this.checkAuthCredentials()) return;
    if (clipboard.length > this.maxLength) {
        clipboard = clipboard.substr(0, this.maxLength - 3) + '...';
    }

    var cryptoKey = settings.get('cryptoKey');
    if (!cryptoKey) {
        throw new Error('no_crypto_key');
    }

    var encrypted = Crypto.encrypt(cryptoKey, clipboard);
    var self = this;
    var data = {
          device_id: this.deviceId
        , iv: encrypted.iv
        , ct: encrypted.ct
    };

    this.post('/sync', data, true, (err, res) => {
        DEBUG('superagent sync status ' + res.status);
        if (err) {
            self.trigger('err', err);
        }
    });

    DEBUG('superagent sync start ' + JSON.stringify(data));
};

Proto.start = function(onstart, onerror) {
    var self = this;
    var sio = this.sio = io.connect(this.endpoint, {
          'max reconnection attempts': Infinity
        , 'force new connection': true
        , 'reconnection limit': 60000
        , 'reconnection delay': 100
    });

    sio.on('connect', function() {

        DEBUG('sio connect');

        sio.emit('auth', self.credentials, function(err) {

            DEBUG('sio auth');

            if (err) {
                var err = new Error(err);
                onerror && onerror(err);
                self.trigger('err', err);
                self.disable();
            } else {
                onstart && onstart();
                self.connecting = false;
                self.trigger('enable');
            }
        });
    });

    sio.on('error', function() {
        DEBUG('sio error ' + JSON.stringify(arguments));
    });

    sio.on('disconnect', function() {
        DEBUG('sio disconnect ' + JSON.stringify(arguments));
        self.enabled && sio.socket.reconnect();
    });

    sio.on('sync', function(msg) {
        if (self.deviceId != msg.deviceId) {
            self.trigger('sync', msg);
        }
    });

    sio.on('handshake_failed', function() {
        DEBUG('sio handshake_failed');
        if (!sio.socket.reconnecting) {
            sio.socket.reconnect();
        }
    });

    sio.on('reconnecting', function() {
        DEBUG('sio reconnecting');
        self.connecting = true;
        self.trigger('connecting');
    });
    
    sio.on('connect_error', (error) => {
        DEBUG('sio error');
        DEBUG(error);
    });
};

Proto.stop = function() {
    if (this.sio) {
        this.sio.socket.reconnecting = false;
        this.sio.socket.removeAllListeners();
        this.sio.removeAllListeners();
        this.sio.disconnect();
        this.sio = null;
    }
};

Proto.enable = function() {
    if (this.enabled || !this.checkAuthCredentials())
        return;

    this.enabled = true;
    this.connecting = true;
    this.trigger('connecting');
    this.start();
};

Proto.disable = function() {
    if (!this.enabled) return;

    this.enabled = false;
    this.connecting = false;
    this.trigger('disable');
    this.stop();
};

function errorify(res) {
    if (res.body && res.body.error) {
        return res.body.error;
    } else if (res.text) {
        return res.text;
    } else {
        return res;
    }
}

function DEBUG(msg) {
    console.log('debug', msg);
}