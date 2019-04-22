const EventEmitter = require('events');
const clipboardy = require('clipboardy');

class Clipboard extends EventEmitter {
    constructor() {
        super();
        
        var self = this;

        this.timer = null;
        
        // alias the emit function
        this.trigger = this.emit;
    }
}

module.exports = new Clipboard();

var Proto = Clipboard.prototype;

Proto.get = function(cb) {
    return clipboardy.read();
};

Proto.set = function(content) {
    var active = !!this.timer;

    if (active) {
        this.stop();
    }
    
    return new Promise((resolve, reject) => {
        clipboardy.write(content).then(() => {
            if (active) {
                this.start();
            }

            resolve(true);
        });
    });
};

Proto.start = function() {
    var self = this;
    this.get().then((data) => {
        var oldValue = data;
        this.stop();
        this.timer = setInterval(function() {
            self.get().then((data) => {
                var newValue = data;
                if (newValue.trim().length && newValue !== oldValue) {
                    self.trigger('change', oldValue = newValue);
                }
            }).catch((err) => {
                console.error(err);
            });
        }, 500);
    });
};

Proto.stop = function() {
    if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
    }
};