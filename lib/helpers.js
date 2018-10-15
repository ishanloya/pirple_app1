// 
// 
// helpers
// 

// dependencies
const crypto = require('crypto');
const config = require('./config');
const https = require('https');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');

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
};

// send an sms via Twilio
helpers.sendTwilioSms = (phone, msg, callback) => {
    // validate params
    phone = typeof(phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;
    msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false;
    if(phone && msg) {
        // configure the request payload
        var payload = {
            'From': config.twilio.fromPhone,
            'To': `+91${phone}`,
            'Body': msg
        };

        // stringify payload
        var stringPayload = querystring.stringify(payload);

        // configure request details
        var requestDetails = {
            'protocol': 'https:',
            'hostname': 'api.twilio.com',
            'method': 'POST',
            'path': `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
            'auth': `${config.twilio.accountSid}:${config.twilio.authToken}`,
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(stringPayload)
            }
        };

        // instantiate request object
        var req = https.request(requestDetails, res => {
            // grab the status of the sent request
            var status = res.statusCode;
            // callback successfully if request went through
            if(status == 200 || status == 201) {
                callback(false);
            } else {
                callback(`Status code returned was ${status}`);
            }
        });

        // bind to error event in case of error so it doesn't get thrown (kill the thread)
        req.on('error', e => {
            callback(e);
        });

        // add the payload
        req.write(stringPayload);

        // send (end) the request
        req.end();
    } else {
        callback('Given parameters were missing or invalid');
    }
};

// get the string content of a template
helpers.getTemplate = (templateName, data, callback) => {
    templateName = typeof(templateName) == 'string' && templateName.length > 0 ? templateName : false;
    data = typeof(data) == 'object' && data !== null ? data : {};

    if(templateName) {
        var templatesDir = path.join(__dirname, '/../templates');
        fs.readFile(`${templatesDir}/${templateName}.html`, 'utf8', (err, str) => {
            if(!err && str && str.length > 0) {
                // do interpolation on string
                var finalString = helpers.interpolate(str, data);
                callback(false, finalString);
            } else {
                callback('No template could be found');
            }
        });
    } else {
        callback('A valid template name was not specified');
    }
};

// replace #[block.content] in _layout.html with str
helpers.addUniversalTemplates = (str, data, callback) => {
    str = typeof(str) == 'string' && str.length > 0 ? str : '';
    data = typeof(data) == 'object' && data !== null ? data : {};
    // get the layout
    helpers.getTemplate('_layout', data, (err, layoutString) => {
        if(!err && layoutString) {
            var replace = str;
            var find = '{block.content}';
            // add them together
            var fullString = layoutString.replace(find, replace);
            callback(false, fullString);             
        } else {
            callback('Could not find the layout template');
        }
    });
};

// take a given string and a data object and find/replace all keys within it
helpers.interpolate = (str, data) => {
    str = typeof(str) == 'string' && str.length > 0 ? str : '';
    data = typeof(data) == 'object' && data !== null ? data : {};

    // add the templateGlobals to the data object, prepending their key name with global
    for(let key in config.templateGlobals) {
        if(config.templateGlobals.hasOwnProperty(key)) {
            data[`global.${key}`] = config.templateGlobals[key];
        }
    }

    // for each key in the data object, insert its value into the string at the corresponding placeholder
    for(let key in data){
        if(data.hasOwnProperty(key) && typeof(data[key]) == 'string') {
            var replace = data[key];
            var find = `{${key}}`;
            str = str.replace(find, replace);
        }
    }
    return str;
};

// get the contents of a static (public) asset
helpers.getStaticAsset = (fileName, callback) => {
    fileName = typeof(fileName) == 'string' && fileName.length > 0 ? fileName : false;
    if(fileName) {
        var publicDir = path.join(__dirname, '/../public');
        fs.readFile(`${publicDir}/${fileName}`, (err, data) => {
            if(!err && data) {
                callback(false, data);
            } else {
                callback('No file could be found');
            }
        });
    } else {
        callback('A valid file name was not specified');
    }
};

module.exports = helpers;