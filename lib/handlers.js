// these are the request handlers

// dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');
// define handlers

var handlers = {};

/*
 *
 * HTML Handlers
 *
 */

// index handler
handlers.index = (data, callback) => {
    // reject any request that is not a GET
    if(data.method == 'get') {

        // prepare data for interpolation
        var templateData = {
            'head.title': 'This is the title',
            'head.desciption': 'This is the meta description',
            'body.title': 'Hello templated world',
            'body.class': 'index'
        };

        // read in a template as a string
        helpers.getTemplate('index', templateData, (err, str) => {
            if(!err && str) {
                // add the universal header and footer
                helpers.addUniversalTemplates(str, templateData, (err, str) => {
                    if(!err && str) {
                        // return page as html
                        callback(200, str, 'html');
                    } else {
                        callback(500, undefined, 'html');
                    }
                });
            } else {
                callback(500, undefined, 'html');
            }
        });
    } else {
        callback(405, undefined, 'html');
    }
};

// favicon
handlers.favicon = (data, callback) => {
    // reject any request that is not a GET
    if(data.method == 'get') {
        // read in the favicon data
        helpers.getStaticAsset('favicon.ico', (err, data) => {
            if(!err && data) {
                // callback the data
                callback(200, data, 'favicon');
            } else {
                callback(500);
            }
        });
    } else {
        callback(405);
    }
};

// public assets
handlers.public = (data, callback) => {
    // reject any request that is not a GET
    if(data.method == 'get') {
        // get the filename being requested
        var trimmedAssetName = data.trimmedPath.replace('public/', '').trim();
        if(trimmedAssetName.length > 0){
            // read in the asset's data
            helpers.getStaticAsset(trimmedAssetName, (err, data) => {
                if(!err && data) {
                    // determine the content type and default to plain text
                    var contentType = 'plain';

                    if(trimmedAssetName.indexOf('.css') > -1){
                        contentType = 'css';
                    }
                    if(trimmedAssetName.indexOf('.png') > -1){
                        contentType = 'png';
                    }
                    if(trimmedAssetName.indexOf('.jpg') > -1){
                        contentType = 'jpg';
                    }
                    if(trimmedAssetName.indexOf('.ico') > -1){
                        contentType = 'favicon';
                    }
                    // callback the data
                    callback(200, data, contentType);

                } else {
                    callback(404);
                }
            });
        } else {
            callback(404);
        }
    } else {
        callback(405);
    }
};

/*
 *
 * JSON API Handlers
 *
 */


// users
handlers.users = (data, callback) => {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1) {
        handlers._users[data.method](data, callback);
    } else {
        callback(405);
    }

};

// container for users submethods
handlers._users = {};

// users - post
// required data: firstName, lastName, phone, password, tosAgreement
// optional data: none
handlers._users.post = (data, callback) => {
    // check all reqd fields are present
    var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    var tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

    if(firstName && lastName && phone && password && tosAgreement) {
        // ensure that the user doesn't already exist
        _data.read('users', phone, (err, data) => {
            if(err) {
                // hash the password
                var hashedPassword = helpers.hash(password);

                // create the user object
                if(hashedPassword) {
                    var userObject = {firstName, lastName, phone, hashedPassword, 'tosAgreement' : true};
    
                    // store the user
                    _data.create('users', phone, userObject, err => {
                        if (!err) {
                            callback(200);
                        } else {
                            console.log(err);
                            callback(500, {'Error' : 'Could not create the new user'});
                        }
                    });
                } else {
                    callback(500, {'Error': 'Could not hash the user\'s password'});
                }
            } else {
                callback(400, {'Error' : 'A user with that phone number already exists'});
            }
        });
    } else {
        callback(400, {'Error' : 'Missing required fields'});
    }
};

// users - get
// required data: phone
// optional data: none
// only let authenticated users access their object. Don't let them access other's objects
handlers._users.get = (data, callback) => {
    // check that the phone number provided is valid
    var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
    if (phone) {
        // get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        // verify that given token is valid for the phone number
        handlers._tokens.verifyToken(token, phone, tokenIsValid => {
            if(tokenIsValid) {
                // lookup the user
                _data.read('users', phone, (err, data) => {
                    if (!err && data) {
                        // remove the hashed password from the user object before returning it to the requester
                        delete data.hashedPassword;
                        callback(200, data);
                    } else {
                        callback(404);
                    }
                });
            } else {
                callback(403, {'Error': 'Missing required token in header or token is invalid'});
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field'});
    }
};

// users - put
// required data: phone
// optional data: firstName, lastName, password (at least one must be specified)
// only let authenticated user update their own object, not anyone else's
handlers._users.put = (data, callback) => {
    // check for required field
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;

    // check for optional fields
    var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    
    // error if phone is not included
    if  (phone){
        // error if none of the optional fields is included
        if (firstName || lastName || password) {
            // get the token from the headers
            var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
            // verify that given token is valid for the phone number
            handlers._tokens.verifyToken(token, phone, tokenIsValid => {
                if(tokenIsValid) {
                    // lookup the user
                    _data.read('users', phone, (err, userData) => {
                        if(!err && userData) {
                            // update the fields necessary
                            if(firstName) {
                                userData.firstName = firstName;
                            }
                            if(lastName) {
                                userData.lastName = lastName;
                            }
                            if(password) {
                                userData.hashedPassword = helpers.hash(password);
                            }

                            // store new updates
                            _data.update('users', phone, userData, err => {
                                if(!err) {
                                    callback(200);
                                } else {
                                    callback(500, {'Error': 'Could not update the user'});
                                }
                            })
                        } else {
                            callback(400, {'Error' : 'Specified user does not exist'});
                        }
                    });
                } else {
                    callback(403, {'Error': 'Missing required token in header or token is invalid'});
                }
            });
        } else {
            callback(400, {'Error': 'Missing field to update'});
        }
    } else {
        callback(400, {'Error' : 'Missing required fields'});
    }
};

// users - delete
// required data: phone
// optional data: none
// only let authenticated user delete their own object, no one else's
// cleanup (delete) any other data files associated with this user
handlers._users.delete = (data, callback) => {
    // check for required field
    var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;

    if(phone) {
        // get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        // verify that given token is valid for the phone number
        handlers._tokens.verifyToken(token, phone, tokenIsValid => {
            if(tokenIsValid) {
                // lookup the user
                _data.read('users', phone, (err, userData) => {
                    if(!err && userData) {
                        // delete the user
                        _data.delete('users', phone, err => {
                            if(!err) {
                                
                                // delete all the checks for that user
                                var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                                var checksToDelete = userChecks.length;
                                if(checksToDelete > 0) {
                                    var checksDeleted = 0;
                                    var deletionErrors = false;
                                    // loop through checks
                                    userChecks.forEach(checkId => {
                                        // delete the check
                                        _data.delete('checks', checkId, err=> {
                                            if(err) {
                                                deletionErrors = true;
                                            }
                                            checksDeleted++;
                                            if(checksDeleted == checksToDelete) {
                                                if(!deletionErrors) {
                                                    callback(200);
                                                } else {
                                                    callback(500, {'Error': 'Errors encountered while attempting to delete user checks, all checks may not have been deleted'});
                                                }
                                            }
                                        });
                                    });
                                } else {
                                    callback(200);
                                }
                            } else {
                                callback(500, {'Error': 'Could not delete user'});
                            }
                        });
                    } else {
                        callback(400, {'Error': 'Specified user does not exist'});
                    }
                });
            } else {
                callback(403, {'Error': 'Missing required token in header or token is invalid'});
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field'});
    }
};

// tokens
handlers.tokens = (data, callback) => {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1) {
        handlers._tokens[data.method](data, callback);
    } else {
        callback(405);
    }

};

// container for tokens submethods
handlers._tokens = {};

// tokens - post
// required data: phone, password
// optional data: none
handlers._tokens.post = (data, callback) => {
    // check required fields
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

    if(phone && password) {
        // lookup user matching the phone number
        _data.read('users', phone, (err, userData) => {
            if(!err && userData) {
                // compare the hashed sent password to the password stored in the user object
                var hashedPassword = helpers.hash(password);

                if(hashedPassword == userData.hashedPassword) {
                    // create token with random name, set expiration date to 1 hour in the future 
                    var tokenId = helpers.createRandomString(20);
                    var expires = Date.now() + 1000 * 60 * 60;
                    var tokenObject = {'id': tokenId, phone, expires};
                    
                    // store token
                    _data.create('tokens', tokenId, tokenObject, err => {
                        if(!err) {
                            callback(200, tokenObject);
                        } else {
                            callback(500, {'Error': 'Could not create token'});
                        }
                    });
                } else {
                    callback(400, {'Error': 'Incorrect password. Cannot create token'});
                }
            } else {
                callback(400, {'Error': 'Could not find the specified user'});
            }
        });
    } else {
        callback(400, {'Error': 'Missing required fields'});
    }
};

// tokens - get
// required data: id
// optional data: none
handlers._tokens.get = (data, callback) => {
    // check that the id sent in the query string is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
        // lookup the token
        _data.read('tokens', id, (err, tokenData) => {
            if (!err && tokenData) {
                callback(200, tokenData);
            } else {
                callback(404);
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field'});
    }
};

// tokens - put
// required data: id, extend
// optional data: none
handlers._tokens.put = (data, callback) => {
    var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
    var extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
    if(id && extend) {
        // lookup the token
        _data.read('tokens', id, (err, tokenData) => {
            if(!err && tokenData) {
                // check to make sure that the token isn't already expired
                if(tokenData.expires > Date.now()) {
                    // set expiration an hour from now
                    tokenData.expires = Date.now() + 1000 * 60 * 60;
                    // store new updates
                    _data.update('tokens', id, tokenData, err => {
                        if(!err) {
                            callback(200);
                        } else {
                            callback(500, {'Error': 'Could not update the token'});
                        }
                    });
                } else {
                    callback(400, {'Error': 'Token has already expired and cannot be extended'});
                }
            } else {
                callback(400, {'Error': 'Specified token does not exist'});
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field(s) or field(s) are invalid'});
    }
};

// tokens - delete
// required data: id
// optional data: none
handlers._tokens.delete = (data, callback) => {
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if(id) {
        // lookup token
        _data.read('tokens', id, (err, tokenData) => {
            if(!err && tokenData) {
                _data.delete('tokens', id, err => {
                    if(!err) {
                        callback(200);
                    } else {
                        callback(500, {'Error': 'Error deleting token'});
                    }
                })
            } else {
                callback(400, {'Error': 'Specified token does not exist'});
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field'});
    }
};

// verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = (id, phone, callback)=> {
    // lookup token id
    _data.read('tokens', id, (err, tokenData) => {
        if(!err && tokenData) {
            // check that the token is for the given user and has not expired
            if(tokenData.phone == phone && tokenData.expires > Date.now()) {
                callback(true);
            } else {
                callback(false);
            }
        } else {
            callback(false);
        }
    });
};


// checks
handlers.checks = (data, callback) => {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1) {
        handlers._checks[data.method](data, callback);
    } else {
        callback(405);
    }

};

// container for checks submethods
handlers._checks = {};


// checks - post
// required data: protocol, url, method, successCodes, timeoutSeconds
// optional data: none
handlers._checks.post = (data, callback) => {
    // validate inputs
    var protocol = typeof(data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    var method = typeof(data.payload.method) == 'string' && ['get', 'put', 'post', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    if(protocol && url && method && successCodes && timeoutSeconds) {
        // get token from headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        // lookup user by reading the token
        _data.read('tokens', token, (err, tokenData) => {
            if(!err, tokenData) {
                var userPhone = tokenData.phone;
                
                // lookup user data
                _data.read('users', userPhone, (err, userData) => {
                    if(!err && userData) {
                        var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                        // verify user has less than the number of max checks per user
                        if(userChecks.length < config.maxChecks) {
                            // create a random id for the check
                            var checkId = helpers.createRandomString(20);

                            // create check object and include the user's phone
                            var checkObject = {'id': checkId, userPhone, protocol, url, method, successCodes, timeoutSeconds};

                            // save object
                            _data.create('checks', checkId, checkObject, err => {
                                if(!err) {
                                    // add check id to the user's object
                                    userData.checks = userChecks;
                                    userData.checks.push(checkId);

                                    // save the new user data
                                    _data.update('users', userPhone, userData, err => {
                                        if(!err) {
                                            // return the data about the new check
                                            callback(200, checkObject);
                                        } else {
                                            callback(500, {'Error': 'Could not update the user with the new check'});
                                        }
                                    });
                                } else {
                                    callback(500, {'Error': 'Could not create new check'});
                                }
                            });
                        } else {
                            callback(400, {'Error': `The user already has the maximum number of checks: ${config.maxChecks}`});
                        }
                    } else {
                        callback(403);
                    }
                });
            } else {
                callback(403);
            }
        });
    } else {
        callback(400, {'Error': 'Missing required input(s) or input is invalid'});
    }
};

// checks - get
// required data: id
// optional data: none
handlers._checks.get = (data, callback) => {
    // check that the id provided is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
        // lookup check
        _data.read('checks', id, (err, checkData) => {
            if(!err && checkData) {
                // get the token from the headers
                var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                // verify that given token is valid and belongs to the user who created the check
                handlers._tokens.verifyToken(token, checkData.userPhone, tokenIsValid => {
                    if(tokenIsValid) {
                        // return check data
                        callback(200, checkData);
                    } else {
                        callback(403);
                    }
                });
            } else {
                callback(404);
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field'});
    }
};

// checks - put
// required data: id
// optional data: url, method, protocol, successCodes, timeoutSeconds (at least one must be specified)
handlers._checks.put = (data, callback) => {
    // check for required field
    var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;

    // check for optional fields
    var protocol = typeof(data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    var method = typeof(data.payload.method) == 'string' && ['get', 'put', 'post', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;
    
    // error if id is not included
    if  (id){
        // error if none of the optional fields is included
        if (protocol || url || method || successCodes || timeoutSeconds) {
            // lookup the check
            _data.read('checks', id, (err, checkData) => {
                if(!err && checkData) {
                    // get the token from the headers
                    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                    // verify that given token is valid and belongs to the user who create the check
                    handlers._tokens.verifyToken(token, checkData.userPhone, tokenIsValid => {
                        if(tokenIsValid) {
                            // update the necessary fields
                            if(protocol) {
                                checkData.protocol = protocol;
                            }
                            if(url) {
                                checkData.url = url;
                            }
                            if(method) {
                                checkData.method = method;
                            }
                            if(successCodes) {
                                checkData.successCodes = successCodes;
                            }
                            if(timeoutSeconds) {
                                checkData.timeoutSeconds = timeoutSeconds;
                            }

                            // store new updates
                            _data.update('checks', id, checkData, err => {
                                if(!err) {
                                    callback(200);
                                } else {
                                    callback(500, {'Error': 'Could not update the check'});
                                }
                            });
                        } else {
                            callback(403, {'Error': 'Missing required token in header or token is invalid'});
                        }
                    });
                } else {
                    callback(404);
                }
            });      
        } else {
            callback(400, {'Error': 'Missing field to update'});
        }
    } else {
        callback(400, {'Error' : 'Missing required fields'});
    }
};

// checks - delete
// required data: id
// optional data: none
handlers._checks.delete = (data, callback) => {
    // check for required field
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;

    if(id) {
        // lookup the check
        _data.read('checks', id, (err, checkData) => {
            if(!err && checkData) {
                // get the token from the headers
                var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                // verify that given token is valid and belongs to the user who create the check
                handlers._tokens.verifyToken(token, checkData.userPhone, tokenIsValid => {
                    if(tokenIsValid) {
                        // delete the check
                        _data.delete('checks', id, err => {
                            if(!err) {
                                // get user data
                                _data.read('users', checkData.userPhone, (err, userData) => {
                                    if(!err && userData) {

                                        var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                                        
                                        // remove check from user object
                                        var checkPosition = userChecks.indexOf(id);
                                        if(checkPosition > -1) {
                                            userChecks.splice(checkPosition, 1);
                                            // resave user data
                                            _data.update('users', checkData.userPhone, userData, err => {
                                                if(!err) {
                                                    callback(200);
                                                } else {
                                                    callback(500, {'Error': 'Could not update user'});
                                                }
                                            });
                                        } else {
                                            callback(500, {'Error': 'Could not find the check on the user\'s object so could not remove it'});
                                        }
                                    } else {
                                        callback(500, {'Error': 'Could not find the user who created the check'});
                                    }
                                });
                            } else {
                                callback(500, {'Error': 'Error deleting check'});
                            }
                        });
                    } else {
                        callback(403, {'Error': 'Missing required token in header or token is invalid'});
                    }
                });
            } else {
                callback(403);
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field'});
    }
};

// ping handler
handlers.ping = (data, callback) => {
    // callback a http status code, and a payload object
    callback(200);
};

// not found handler
handlers.notFound = (data, callback) => {
    callback(404);
};


module.exports = handlers;