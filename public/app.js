/*
 * Front-end js for the app
 *
 */

//  container for the front-end application
 var app = {};

//  config
app.config = {
    'sessionToken': false
};

// AJAX client (for the restful API)
app.client = {};

// interface for making api calls
app.client.request = (headers, path, method, queryStringObject, payload, callback) => {

    // set defaults
    headers = typeof(headers) == 'object' && headers !== null ? headers : {};
    path = typeof(path) == 'string' ? path : '/';
    method = typeof(method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE'].indexOf(method) > -1 ? method.toUpperCase() : 'GET';
    queryStringObject = typeof(queryStringObject) == 'object' && queryStringObject !== null ? queryStringObject : {};
    payload = typeof(payload) == 'object' && payload !== null ? payload : {};
    callback = typeof(callback) == 'function' ? callback : false;

    // for each query string parameter sent, add it to the path
    var requestUrl = `${path}?`;
    var counter = 0;
    for(let queryKey in queryStringObject) {
        if(queryStringObject.hasOwnProperty(queryKey)) {
            counter++;
            // if at least 1 query string param has already been added, prepend new param with '&'
            if(counter > 1) {
                requestUrl+='&';
            }
            // add the key and value
            requestUrl+=`${queryKey}=${queryStringObject[queryKey]}`;
        }
    }

    // form the http request as a JSON type
    var xhr = new XMLHttpRequest();
    xhr.open(method, requestUrl, true);
    xhr.setRequestHeader("Content-Type","application/json");

    // for each header sent, add it to the request
    for(let headerKey in headers) {
        if(headers.hasOwnProperty(headerKey)) {
            xhr.setRequestHeader(headerKey, headers[headerKey]);
        }
    }

    // if there is a current session token, add that as a header
    if(app.config.sessionToken) {
        xhr.setRequestHeader("token", app.config.sessionToken.id);
    }

    // when the request comes back, handle the request
    xhr.onreadystatechange = () => {
        if(xhr.readyState == XMLHttpRequest.DONE) {
            var statusCode = xhr.status;
            var responseReturned = xhr.responseText;

            // callback if requested
            if(callback) {
                try {
                    let parsedResponse = JSON.parse(responseReturned);
                    callback(statusCode, parsedResponse);
                } catch (error) {
                    callback(statusCode, false);
                }
            }
        }
    };

    // send the payload as JSON
    var payloadString = JSON.stringify(payload);
    xhr.send(payloadString);

};