const app = express();

// Ensure your router is mounted correctly in your main app.js/server.js:
app.use('/api/v1', router);  // Assuming you're using an /api/v1 prefix

// 404 Handler - Place this AFTER mounting your router
app.use((req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});

// General Error Handler
app.use((error, req, res, next) => {
    res.status(error.status || 500);
    res.json({
        error: {
            message: error.message,
            status: error.status
        }
    });
});