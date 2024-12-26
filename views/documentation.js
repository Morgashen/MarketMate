const renderApiDocumentation = (apiInfo) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${apiInfo.name}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                :root {
                    --primary-color: #2c3e50;
                    --secondary-color: #34495e;
                    --accent-color: #e67e22;
                    --link-color: #2980b9;
                    --text-color: #7f8c8d;
                    --background-color: #f8f9fa;
                }

                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    max-width: 1200px;
                    margin: 2rem auto;
                    padding: 0 2rem;
                    line-height: 1.6;
                    color: var(--primary-color);
                }

                .header {
                    text-align: center;
                    margin-bottom: 3rem;
                    padding-bottom: 2rem;
                    border-bottom: 2px solid var(--background-color);
                }

                .header h1 {
                    color: var(--primary-color);
                    margin-bottom: 0.5rem;
                }

                .header p {
                    color: var(--text-color);
                    font-size: 1.1rem;
                }

                .section {
                    margin: 2rem 0;
                }

                .section-title {
                    color: var(--secondary-color);
                    margin-bottom: 1rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 1px solid var(--background-color);
                }

                .endpoint-group {
                    margin: 2rem 0;
                }

                .endpoint-group h3 {
                    color: var(--secondary-color);
                    margin: 1rem 0;
                }

                .endpoint {
                    background: var(--background-color);
                    border-radius: 8px;
                    padding: 1.5rem;
                    margin: 1rem 0;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .endpoint:hover {
                    transform: translateY(-2px);
                    transition: transform 0.2s ease;
                }

                .method {
                    display: inline-block;
                    padding: 0.3rem 0.8rem;
                    border-radius: 4px;
                    font-weight: bold;
                    margin-right: 1rem;
                }

                .method.get { background: #61affe; color: white; }
                .method.post { background: #49cc90; color: white; }
                .method.put { background: #fca130; color: white; }
                .method.delete { background: #f93e3e; color: white; }

                .path {
                    color: var(--link-color);
                    font-family: monospace;
                    font-size: 1.1rem;
                }

                .description {
                    margin-top: 0.5rem;
                    color: var(--text-color);
                }

                .auth-required {
                    display: inline-block;
                    margin-left: 1rem;
                    padding: 0.2rem 0.5rem;
                    background: #e0e0e0;
                    border-radius: 4px;
                    font-size: 0.9rem;
                    color: var(--text-color);
                }

                .documentation-links {
                    margin-top: 3rem;
                    padding: 1.5rem;
                    background: var(--background-color);
                    border-radius: 8px;
                }

                .documentation-links h2 {
                    margin-top: 0;
                }

                code {
                    background: #e0e0e0;
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                    font-family: monospace;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${apiInfo.name} - v${apiInfo.version}</h1>
                <p>${apiInfo.description}</p>
                <p><strong>Environment:</strong> ${apiInfo.environment}</p>
            </div>

            <div class="section">
                <h2 class="section-title">Available Endpoints</h2>
                ${Object.entries(apiInfo.endpoints).map(([group, info]) => `
                    <div class="endpoint-group">
                        <h3>${group.charAt(0).toUpperCase() + group.slice(1)}</h3>
                        ${info.routes.map(route => `
                            <div class="endpoint">
                                <span class="method ${route.method.toLowerCase()}">${route.method}</span>
                                <span class="path">${info.base}${route.path}</span>
                                ${route.description.includes('requires authentication') ?
            '<span class="auth-required">🔒 Authentication Required</span>' :
            ''}
                                <div class="description">${route.description}</div>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>

            <div class="documentation-links">
                <h2>Additional Resources</h2>
                <p>${apiInfo.documentation.description}</p>
                <p><strong>Health Check Endpoint:</strong> <code>${apiInfo.documentation.healthCheck}</code></p>
                <p><strong>Connection Test Endpoint:</strong> <code>${apiInfo.documentation.connectionTest}</code></p>
            </div>
        </body>
        </html>
    `;
};

module.exports = {
    renderApiDocumentation
};