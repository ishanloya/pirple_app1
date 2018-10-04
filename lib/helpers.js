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

// create a string of random alphanumeric characters of a given length
helpers.createRandomString = (strLength) => {
    strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
    if (strLength) {
        // define all possible characters
        var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz1234567890';

        // start the final string
        var str = '';
        for(i=1; i <= strLength; i++) {
            // get a random character & append to final string
            var randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
            str += randomCharacter;
        }

        return str;
    } else {
        return false;
    }
}

// error messages
helpers.errors = (helperName) => {

    var helpers = {
        'missingFields': [400, 'Missing required fields'],
        'userNotFound': [400, 'User not found']
    };

    return (helpers[helperName][0], {'Error': helpers[helperName][1]})
};


module.exports = helpers;