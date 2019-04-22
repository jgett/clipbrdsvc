const net = require('net');
const prompt = require('prompt');
const config = require('config');
const Crypto = require('./crypto.js');

var socket = new net.Socket();

socket.on('data', (data) => {
    console.log(JSON.parse(data.toString('utf8')));
    getUserInput();
});

socket.on('error', (err) => {
    if (err.code === 'ECONNREFUSED')
        console.log('Server not found at ' + err.address + ':' + err.port);
    else
        console.log(err.message);
    
    socket.destroy();
    
    process.exit(1);
});

prompt.start();

prompt.message = "";
prompt.delimiter = "";
prompt.colors = false;

function getSignIn() {
    prompt.get({
        properties: {
            email: {
                message: 'email',
                required: true
            },
            passw: {
                message: 'passw',
                required: true,
                hidden: true
            }
        }
    }, (err, result) => {
        if (err) {
            console.error(err);
            getUserInput();
        } else {
            var ckey = Crypto.createKey(result.email, result.passw);
            var hash = Crypto.createHash(result.email, ckey);
            
            socket.write(JSON.stringify({
                command: 'signin',
                email: result.email,
                ckey: ckey,
                hash: hash
            }));
        }
    });
}

function handleInput(input) {
    var cmd = null;
    
    if (input && input['>']) {
        cmd = input['>'];
    }
    
    if (cmd === 'exit') {
        socket.destroy();
        console.log('bye');
        return;
    }
    
    if (cmd === 'signin') {
        getSignIn();
        return;
    }
    
    if (cmd !== null && cmd.length > 0) {
        socket.write(JSON.stringify({command: cmd}));
    }
}

function getUserInput() {
    prompt.get({
        properties: {
            '>': {description: ""}
        }
    },
    (err, result) => {
        handleInput(result);
    });
}

socket.connect(config.port, config.host, () => {
    getUserInput();
});

process.on('SIGINT', () => {
    socket.destroy();
    console.log('bye');
});