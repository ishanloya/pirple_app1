/*
*
* primary file for the API
*
*/

// dependencies
const http = require('http');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;

// the server should respond to all requests with a string
const server = http.createServer((req, res) => {
    
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

        // send the response
        res.end('Hello World!\n');
        // log the request path
        console.log(buffer);
    });
});

// start the server and listen on port 3000
server.listen(3000, () => {
    console.log('The server is listening on port 3000 now');
});

// define the handlers
var handlers = {

};

// sample handler
handlers.sample = (data, callback) => {
    // callback a http status code, and a payload object
    callback(406, {'name': 'sample handler'});
};

// not found handler
handlers.notFound = (data, callback) => {
    callback(404);
};

// define a rquest router
var router = {
    'sample': handlers.sample
};