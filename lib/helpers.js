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
helpers.getTemplate = (templateName, callback) => {
    templateName = typeof(templateName) == 'string' && templateName.length > 0 ? templateName : false;
    if(templateName) {
        var templatesDir = path.join(__dirname, '/../templates');
        fs.readFile(`${templatesDir}/${templateName}.html`, 'utf8', (err, str) => {
            if(!err && str && str.length > 0) {
                callback(false, str);
            } else {
                callback('No template could be found');
            }
        });
    } else {
        callback('A valid template name was not specified');
    }
};

module.exports = helpers;