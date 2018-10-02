/*
*
* primary file for the API
*
*/

// dependencies
const http = require('http');
const url = require('url');

// the server should respond to all requests with a string
const server = http.createServer((req, res) => {
    
    // get the url and parse it
    var parsedUrl = url.parse(req.url, true);

    // get the path from the url


    // send the response
    res.end('Hello World!\n');

    // log the request path
});

// start the server and listen on port 3000
server.listen(3000, () => {
    console.log('The server is listening on port 3000 now');
});