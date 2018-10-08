/*
*
* primary file for the API
*
*/

// dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');

// declare the app
var app = {};

// init function
app.init = () => {
    // start the server
    server.init();

    // start the workers
    workers.init();
};

// execute the function
app.init();

// export the app
module.exports = app;