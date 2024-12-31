const setupMetrics = (app) => {
    let requestsTotal = 0;
    let requestsActive = 0;
    let errors = 0;

    // Middleware to track request metrics
    app.use((req, res, next) => {
        requestsTotal++;
        requestsActive++;

        // Track response status
        res.on('finish', () => {
            requestsActive--;
            if (res.statusCode >= 400) {
                errors++;
            }
        });

        next();
    });

    // Endpoint to expose metrics
    app.get('/metrics', (req, res) => {
        const metrics = {
            requests: {
                total: requestsTotal,
                active: requestsActive,
                errors: errors
            },
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };

        res.json(metrics);
    });
};

module.exports = { setupMetrics };