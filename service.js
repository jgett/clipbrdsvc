const net = require('net');
const config = require('config');
const sjcl = require('./libs/sjcl.js');
const API = require('./api');
const settings = require('./settings.js');
const clipboard = require('./clipboard.js');
const Crypto = require('./crypto.js');

var sockets = [];

var api = new API({
      endpoint  : settings.get('endpoint')
    , deviceId  : settings.get('deviceId')
    , maxLength : settings.get('maxLength')
    , email     : settings.get('authEmail')
    , hash      : settings.get('authHash')
});

var server = net.createServer((socket) => {
    sockets.push(socket);
    
    socket.on('data', (data) => {
        var msg = JSON.parse(data.toString('utf8'));
        
        var response = null;
        
        if (msg && msg.command) {
            if (msg.command === 'status') {
                response = api.enabled ? 'online' : 'offline';
            } else if (msg.command === 'enable') {
                if (!api.enabled) {
                    api.enable();
                    settings.set('enabled', true);
                } else {
                    response = 'no action required';
                }
            } else if (msg.command === 'disable') {
                if (api.enabled) {
                    api.disable();
                    settings.set('enabled', false);
                } else {
                    response = 'no action required';
                }
            } else if (msg.command === 'checkauth') {
                if (api.checkAuthCredentials())
                    resposne = 'ok';
            } else if (msg.command === 'signin') {
                if (api.enabled)
                    api.disable();
                
                settings.set('authEmail', msg.email);
                settings.set('authHash', msg.hash);
                settings.set('cryptoKey', msg.ckey);
                
                api.setAuthCredentials(msg.email, msg.hash);
                
                api.enable();
            } else if (msg.command === 'signout') {
                api.signout();
                settings.set('authEmail', null);
                settings.set('authHash', null);
                settings.set('enabled', false);
            } else {
                response = 'unknown command: ' + msg.command;
            }
        } else {
            response = 'bad request';
        }
        
        if (response)
            socket.write(JSON.stringify(response));
    });
    
    socket.on('error', (err) => {
        socket.destroy();
    });
    
    socket.on('close', (err) => {
        socket.destroy();
        console.log('info', 'socket closed');
    });
});

server.listen(config, () => {
    console.log('info', 'server listening at '+config.host+':'+config.port);
    settings.get('enabled') && api.enable();
});

api.on('enable', function() {
    console.log('info', 'api: enable');
    socketWrite('ok');
    clipboard.start();
});

api.on('disable', function() {
    console.log('info', 'api: disable');
    socketWrite('ok');
    clipboard.stop();
});

api.on('connecting', function() {
    console.log('info', 'api: connecting');
});

api.on('err', function(err) {
    console.error('api: err', err.message);
    if (err.message === 'no_credentials') {
        socketWrite('sign in required');
    }
    if (err.message === 'wrong_email_or_hash' || err.message === 'Unauthorized') {
        settings.set('authEmail', null);
        settings.set('authHash', null);
        api.clearAuthCredentials();
        api.disable();
    }
});

api.on('sync', function(msg) {
    console.log('info', 'api: sync');

    if (!msg.iv) {
        throw new Error('no_iv');
    }

    if (!msg.ct) {
        throw new Error('no_ct');
    }

    var cryptoKey = settings.get('cryptoKey');

    if (!cryptoKey) {
        throw new Error('no_crypto_key');
    }

    var plaintext = '';

    try {
        plaintext = Crypto.decrypt(cryptoKey, msg.iv, msg.ct);
    } catch (e) {
        if (e instanceof sjcl.exception.corrupt) {
            api.clearAuthCredentials();
            api.disable();
        } else {
            console.error(e);
        }
        return;
    }

    clipboard.get().then((data) => {
        var localClipboard = data;
        
        if (localClipboard.trim() === plaintext.trim()) {
            console.log('warn', 'warning: incoming clipboard is identical to local clipboard, ignoring');
        } else {
            clipboard.set(plaintext).then(() => {
                console.log('info', 'received new clipboard: ' + plaintext.length + ' chars');
            });
        }
    }).catch((err) => {
        console.error(err);
    });
});

clipboard.on('change', function(clipboard) {
    console.log('info', 'clipboard: change');
    api.sync(clipboard);
});

function socketWrite(data){
    for (var x = 0; x < sockets.length; ++x) {
        var socket = sockets[x];
        socket.write(JSON.stringify(data));
    }
}