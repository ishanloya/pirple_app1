/*
*
* primary file for the API
*
*/

// dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const fs = require('fs');

// instantiating the http server
const httpServer = http.createServer((req, res) => {
    unifiedServer(req, res);
});

// start the server and listen on port specified in config file
httpServer.listen(config.httpPort, () => {
    console.log(`The server is listening on port ${config.httpPort} in ${config.envName} mode now`);
});


// instantiating the https server
const httpsServerOptions = {
    'key': fs.readFileSync('./https/key.pem'),
    'cert': fs.readFileSync('./https/cert.pem')
};
const httpsServer = https.createServer(httpsServerOptions, (req, res) => {
    unifiedServer(req, res);
});

// start the server and listen on port specified in config file
httpsServer.listen(config.httpsPort, () => {
    console.log(`The server is listening on port ${config.httpsPort} in ${config.envName} mode now`);
});


// all the server logic for both http and https servers
var unifiedServer = (req, res) => {
    // get the url and parse it
    var parsedUrl = url.parse(req.url, true);

    // get the path from the url
    var path = parsedUrl.pathname;

    // trims any trailing and leading '/'s
    var trimmedPath = path.replace(/^\/+|\/+$/g,'');

    // get query string as an object
    var queryStringObject = parsedUrl.query;

    // get http method
    var method = req.method.toLowerCase();

    // get headers as an object
    var headers = req.headers;

    // get the payload, if any
    var decoder = new StringDecoder('utf-8');
    var buffer = '';
    // binding on data event of stream
    req.on('data', (data) => {
        buffer += decoder.write(data);
    });
    // binding on end event of stream
    req.on('end', () => {
        buffer += decoder.end();

        // choose handler request should go to, if not found go to not found handler
        var chosenHandler = typeof(router[trimmedPath]) !== 'undefined' ? router[trimmedPath] : handlers.notFound;

        // construct data object to send to handler
        var data = {
            'trimmedPath': trimmedPath,
            'queryStringObject': queryStringObject,
            'method': method,
            'headers': headers,
            'payload': buffer
        };

        // route the request to the handler specified in the router
        chosenHandler(data, (statusCode, payload) => {

            // use the status code called back by the handler or default to 200
            statusCode = typeof(statusCode) == 'number' ? statusCode : 200;

            // use the payload called back by the handler or default to an empty object
            payload = typeof(payload) == 'object' ? payload : {};

            // convert payload tp string
            var payloadString = JSON.stringify(payload);

            // return the response
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(statusCode);
            res.end(payloadString);
            
            // log the request path
            console.log('Returning this response: ', statusCode, payloadString);
        });
    });
};

// define the handlers
var handlers = {};

// ping handler
handlers.ping = (data, callback) => {
    // callback a http status code, and a payload object
    callback(200);
};

// not found handler
handlers.notFound = (data, callback) => {
    callback(404);
};

// define a rquest router
var router = {
    'ping': handlers.ping,
};