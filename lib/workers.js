// worker-related tasks

// dependencies
const path = require('path');
const fs = require('fs');
const _data = require('./data');
const https = require('https');
const http = require('http');
const helpers = require('./helpers');
const url = require('url');
const _logs = require('./logs');
const util = require('util');
const debug = util.debuglog('workers');

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
                        debug('Error reading one of the check\'s data');
                    }
                });
            });
        } else {
            debug('Error: Could not find any checks to process');
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
        debug('Error: one of the checks is not properly formatted. Skipping it');
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

    // log the outcome
    var timeOfCheck = Date.now(); 
    workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);
    
    // update the check data
    var newCheckData = originalCheckData;
    newCheckData.state = state;
    newCheckData.lastChecked = timeOfCheck;

    // save the updates
    _data.update('checks', newCheckData.id, newCheckData, err => {
        if(!err) {
            // send the new check data to the next phase in the process if needed
            if(alertWarranted) {
                workers.alertUserToStatusChange(newCheckData);
            } else {
                debug('Check outcome has not changed, no alert needed');
            }
        } else {
            debug('Error trying to save updates to one of the checks');
            
        }
    });
};

// alert user to change in their check status
workers.alertUserToStatusChange = newCheckData => {
    var msg = `Alert: your check for ${newCheckData.method.toUpperCase()} ${newCheckData.protocol}://${newCheckData.url} is currently ${newCheckData.state}`;
    helpers.sendTwilioSms(newCheckData.userPhone, msg, err => {
        if(!err) {
            debug('Success: user was alerted to a status change in their check via sms: ', msg);
        } else {
            debug('Error: could not send sms alert to user who had a state change in their check');
        }
    });
};

// create a log file
workers.log = (originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) => {
    // form the log data
    var logData = {
        'check': originalCheckData,
        'outcome': checkOutcome,
        state,
        'alert': alertWarranted,
        'time': timeOfCheck
    };

    // convert data to string
    var logString = JSON.stringify(logData);

    // Determine the name of the log file
    var logFileName = originalCheckData.id;

    // append log string to the file
    _logs.append(logFileName, logString, err => {
        if(!err) {
            debug('Logging to log file succeeded');
        } else {
            debug('Logging to log file failed');
        }
    });
};

// timer to execute the worker-process once per minute
workers.loop = () => {
    setInterval(() => {
        workers.gatherAllChecks();
    }, 1000 * 60);
};

// rotate aka compress the log files
workers.rotateLogs = () => {
    // list all the (non compressed) log files
    _logs.list(false, (err, logs) => {
        if(!err && logs && logs.length > 0) {
            logs.forEach(logName => {
                // compress the data to a different file
                var logId = logName.replace('.log', '');
                var newFileId = `${logId}-${Date.now()}`;
                _logs.compress(logId, newFileId, err => {
                    if(!err) {
                        // truncate the log
                        _logs.truncate(logId, err => {
                            if(!err) {
                                debug('Success truncating log file');
                            } else {
                                debug('Error truncating log file');
                            }
                        });
                    } else {
                        debug('Error compressing one of the log files', err);
                    }
                });
            });
        } else {
            debug('Error: could not find any logs to rotate');
        }
    });
};

// timer to execute the log rotation process once per day
workers.logRotationLoop = () => {
    setInterval(() => {
        workers.rotateLogs();
    }, 1000 * 60 * 60 * 24);
};

// init script
workers.init = () => {
    // send to console, in yellow
    console.log('\x1b[33m%s\x1b[0m', 'Background workers are running');
    // execute all the checks immediately
    workers.gatherAllChecks();
    
    // call the loop so the checks will execute later on
    workers.loop();
    
    // compress all the logs immediately
    workers.rotateLogs();

    // call the compression loop so logs will be compressed later on
    workers.logRotationLoop();
};

// export worker object
module.exports = workers;