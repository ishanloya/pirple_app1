// 
// 
// helpers
// 

// dependencies
const crypto = require('crypto');
const config = require('./config');

// container
var helpers = {};

// create a SHA256 hash
helpers.hash = (str) => {
    if(typeof(str) == 'string' && str.length > 0){
        var hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
        return hash;
    } else {
        return false;
    }
};

// parse a json string to an object in all cases, without throwing
helpers.parseJsonToObject = (str) => {
    try {
        var obj = JSON.parse(str);
        return obj;
    } catch (error) {
        return {};
    }
};


module.exports = helpers;