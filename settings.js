var uuid = {v4: require('uuid/v4')};
var localStorage = new require('node-localstorage').LocalStorage('./scratch');

var store = localStorage;
var defaults = {
      'endpoint'    : 'https://api.clipbrd.com'
    , 'enabled'     : false
    , 'maxLength'   : 1024
    , 'notifyPopup' : true
    , 'notifySound' : true
    , 'authEmail'   : null
    , 'authHash'    : null
};

store.getItem('deviceId') || set('deviceId', uuid.v4());

function get(key) {
    if (store.getItem(key) === undefined) {
        return defaults[key];
    }
    return JSON.parse(store.getItem(key));
}

function set(key, val) {
    store.setItem(key, JSON.stringify(val));
}

module.exports = {
      get: get
    , set: set
};
