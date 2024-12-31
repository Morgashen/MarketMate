const morgan = require('morgan');

const requestLogger = (environment) => {
    morgan.token('body', (req) => JSON.stringify(req.body));
    morgan.token('reqId', (req) => req.id);

    const format = environment === 'development'
        ? ':reqId :method :url :status :response-time ms - :body'
        : ':reqId :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

    return morgan(format, {
        skip: (req) => req.url === '/health' || req.url === '/ping'
    });
};

module.exports = { requestLogger };