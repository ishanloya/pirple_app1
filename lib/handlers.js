// these are the request handlers

// dependencies
const _data = require('./data');
const helpers = require('./helpers');

// define handlers

var handlers = {};

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
                    var userObject = {
                        'firstName' : firstName,
                        'lastName' : lastName,
                        'phone' : phone,
                        'hashedPassword' : hashedPassword,
                        'tosAgreement' : true
                    };
    
                    // store the user
                    _data.create('users', phone, userObject, (err) => {
                        if (!err) {
                            callback(200);
                        } else {
                            console.log(err);
                            callback(500, {'Error' : 'Could not create the new user'});
                        }
                    })    
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
// TODO: only let authenticated users access their object. Don't let them access other's objects
handlers._users.get = (data, callback) => {
    // check that the phone number provided is valid
    var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
    if (phone) {
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
        callback(400, {'Error': 'Missing required field'});
    }
};

// users - put
// required data: phone
// optional data: firstName, lastName, password (at least one must be specified)
// TODO: only let authenticated user update their own object, not anyone else's
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
            callback(400, {'Error': 'Missing field to update'});
        }
    } else {
        callback(400, {'Error' : 'Missing required fields'});
    }
};

// users - delete
// required data: phone
// optional data: none
// TODO: only let authenticated user delete their own object, no one else's
// TODO: cleanup (delete) any other data files associated with this user
handlers._users.delete = (data, callback) => {
    // check for required field
    var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;

    if(phone) {
        // lookup the user
        _data.read('users', phone, (err, userData) => {
            if(!err && userData) {
                // delete the user
                _data.delete('users', phone, err => {
                    if(!err) {
                        callback(200);
                    } else {
                        callback(500, {'Error': 'Could not delete user'});
                    }
                });
            } else {
                callback(400, {'Error': 'Specified user does not exist'});
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