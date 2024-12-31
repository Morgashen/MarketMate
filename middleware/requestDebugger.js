const requestDebugger = (environment) => (req, res, next) => {
    // Skip debugging for health check endpoints
    if (req.path === '/health' || req.path === '/ping') {
        return next();
    }

    const requestInfo = {
        timestamp: new Date().toISOString(),
        requestId: req.id,
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body,
        query: req.query
    };

    if (environment === 'development') {
        console.log('Incoming request:', JSON.stringify(requestInfo, null, 2));
    }

    // Track request timing
    req.requestStartTime = Date.now();

    // Listen for response finish
    res.on('finish', () => {
        const duration = Date.now() - req.requestStartTime;
        const responseInfo = {
            requestId: req.id,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('content-length')
        };

        if (res.statusCode >= 400) {
            console.error('Request failed:', JSON.stringify(responseInfo, null, 2));
        } else if (environment === 'development') {
            console.log('Request completed:', JSON.stringify(responseInfo, null, 2));
        }
    });

    next();
};