// worker-related tasks

// dependencies
const path = require('path');
const fs = require('fs');
const _data = require('./data');
const https = require('https');
const http = require('http');
const helpers = require('./helpers');
const url = require('url');


// instantiate worker object
var workers = {};

// lookup all checks, get their data, send to a validator
workers.gatherAllChecks = () => {
    // get all checks that 
    _data.list('checks', (err, checks) => {
        if(!err && checks && checks.length > 0) {
            checks.forEach(check => {
                // read the check data
                _data.read('checks', check, (err, originalCheckData) => {
                    if(!err && originalCheckData) {
                        // pass check to check validator, and let the function continue or log errors
                        workers.validateCheckData(originalCheckData);
                    } else {
                        console.log('Error reading one of the check\'s data');
                    }
                });
            });
        } else {
            console.log('Error: Could not find any checks to process');
        }
    });
};

// sanity checking the check data
workers.validateCheckData = (originalCheckData) => {
    originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {};
    originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
    originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false;

    originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['http', 'https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
    originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
    originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['get', 'put', 'post', 'delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
    originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
    originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

    // set the keys that may not be set (if the workers have never seen this check before)
    originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
    originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

    // if all checks pass, pass the data along to the next step in the process
    if(originalCheckData.id && originalCheckData.userPhone && originalCheckData.protocol && originalCheckData.url && originalCheckData.method && originalCheckData.successCodes && originalCheckData.timeoutSeconds) {
        workers.performCheck(originalCheckData);
    } else {
        console.log('Error: one of the checks is not properly formatted. Skipping it');
    }
};

// perform the check, send the originalCheckData & the outcome of the process to the next step in the process
workers.performCheck = (originalCheckData) => {
    // prepare the initial check outcomes
    var checkOutcome = {
        'error': false,
        'responseCode': false
    };

    // mark that the outcome has not been sent yet
    var outcomeSent = false;

    // parse the hostname and the path out of the original check data
    var parsedUrl = url.parse(`${originalCheckData.protocol}://${originalCheckData.url}`, true);
    var hostName = parsedUrl.hostname;
    var path = parsedUrl.path; // using path and not "pathname" because we want the query string

    // construct the request
    var requestDetails = {
        'protocol': `${originalCheckData.protocol}:`,
        'hostname': hostName,
        'method': originalCheckData.method.toUpperCase(),
        path,
        'timeout': originalCheckData.timeoutSeconds * 1000
    };

    // instantiate the request object (using either http/https)
    var _moduleToUse = originalCheckData.protocol == 'http' ? http : https;
    var req = _moduleToUse.request(requestDetails, res => {
        // grab the status of the sent request
        var status = res.statusCode;

        // update the check outcome and pass the data along
        checkOutcome.responseCode = status;
        if(!outcomeSent){
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // bind to the error event so it doesn't get thrown
    req.on('error', e => {
        // update the check outcome and pass the data along
        checkOutcome.error = {
            'error': true,
            'value': e
        };
        if(!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // bind to the timeout event
    req.on('timeout', e => {
        // update the check outcome and pass the data along
        checkOutcome.error = {
            'error': true,
            'value': 'timeout'
        };
        if(!outcomeSent) {
            workers.processCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // end the request
    req.end();
};

// process the check outcome, and update the chech data as needed and trigger alert to user if needed
// special logic for accomodating a check that has never been tested before (don't alert on that one)
workers.processCheckOutcome = (originalCheckData, checkOutcome) => {
    // decide if the check is considered up or down
    var state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

    // decide if an alert is warranted
    var alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;

    // update the check data
    var newCheckData = originalCheckData;
    newCheckData.state = state;
    newCheckData.lastChecked = Date.now();

    // save the updates
    _data.update('checks', newCheckData.id, newCheckData, err => {
        if(!err) {
            // send the new check data to the next phase in the process if needed
            if(alertWarranted) {
                workers.alertUserToStatusChange(newCheckData);
            } else {
                console.log('Check outcome has not changed, no alert needed');
            }
        } else {
            console.log('Error trying to save updates to one of the checks');
            
        }
    });
};

// alert user to change in their check status
workers.alertUserToStatusChange = newCheckData => {
    var msg = `Alert: your check for ${newCheckData.method.toUpperCase()} ${newCheckData.protocol}://${newCheckData.url} is currently ${newCheckData.state}`;
    helpers.sendTwilioSms(newCheckData.userPhone, msg, err => {
        if(!err) {
            console.log('Success: user was alerted to a status change in their check via sms: ', msg);
        } else {
            console.log('Error: could not send sms alert to user who had a state change in their check');
        }
    });
};

// timer to execute the worker-process once per minute
workers.loop = () => {
    setInterval(() => {
        workers.gatherAllChecks();
    }, 1000 * 60);
};

// init script
workers.init = () => {
    // execute all the checks immediately
    workers.gatherAllChecks();
    // call the loop so the checks will execute later on
    workers.loop();
};

// export worker object
module.exports = workers;