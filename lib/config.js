// create and export configuration variables

// container for all envs
var environments = {};

// create staging (default) environment
environments.staging = {
    'httpPort': 3000,
    'httpsPort': 3001,
    'envName': 'staging',
    'hashingSecret': 'thisIsASecret',
    'maxChecks': 5,
    'twilio' : {
        'accountSid': 'ACff97b95af3fba3466965d1ac0b2da557',
        'authToken': '3f7bae9f3f6d70bbc68aaf0075e14dc8',
        'fromPhone': '+15005550006'
    },
    'templateGlobals': {
        'appName': 'Uptime Checker',
        'companyName': 'Notarealcompany, Inc.',
        'yearCreated': '2018',
        'baseUrl': 'http://localhost:3000/'
    }
};

// create production environment
environments.production = {
    'httpPort': 5000,
    'httpsPort': 5001,
    'envName': 'production',
    'hashingSecret': 'thisIsAlsoASecret',
    'maxChecks': 5,
    'twilio' : {
        'accountSid': '',
        'authToken': '',
        'fromPhone': ''
    },
    'templateGlobals': {
        'appName': 'Uptime Checker',
        'companyName': 'Notarealcompany, Inc.',
        'yearCreated': '2018',
        'baseUrl': 'http://localhost:5000/'
    }
};

// determine which env was passed as a command-line argument
var currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';

// check that current env is available in the environments object created above, if not, default to staging
var environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : environments.staging;

// export the module
module.exports = environmentToExport;