/**
 * Renders a clean, responsive HTML documentation page
 * @param {Object} apiInfo - Comprehensive API documentation object
 * @returns {string} Fully rendered HTML documentation
 */
const renderApiDocumentation = (apiInfo) => {
    // Helper function to generate endpoint HTML
    const renderEndpointGroup = (groupName, endpoints) => {
        const endpointEntries = Object.entries(endpoints);
        return `
            <div class="api-group">
                <h2>${groupName.charAt(0).toUpperCase() + groupName.slice(1)} Endpoints</h2>
                ${endpointEntries.map(([endpointName, endpointPath]) => `
                    <div class="endpoint">
                        <span class="method">${endpointPath.split(' ')[0]}</span>
                        <strong>${endpointName}</strong>
                        <code>${endpointPath}</code>
                    </div>
                `).join('')}
            </div>
        `;
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${apiInfo.name} Documentation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background-color: #f4f4f4;
        }
        header {
            background-color: #007bff;
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .api-group {
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            padding: 15px;
        }
        .endpoint {
            display: flex;
            align-items: center;
            border-bottom: 1px solid #eee;
            padding: 10px 0;
        }
        .method {
            font-weight: bold;
            margin-right: 15px;
            text-transform: uppercase;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 0.8em;
        }
        .method.GET { background-color: #28a745; color: white; }
        .method.POST { background-color: #007bff; color: white; }
        .method.PUT { background-color: #ffc107; color: black; }
        .method.DELETE { background-color: #dc3545; color: white; }
        .method.PATCH { background-color: #17a2b8; color: white; }
        strong {
            margin-right: 15px;
        }
        code {
            background-color: #f1f1f1;
            padding: 3px 6px;
            border-radius: 3px;
            font-family: monospace;
        }
        footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 0.8em;
        }
    </style>
</head>
<body>
    <header>
        <h1>${apiInfo.name}</h1>
        <p>${apiInfo.description}</p>
        <p>Version: ${apiInfo.version} | Environment: ${apiInfo.environment}</p>
    </header>

    ${Object.entries(apiInfo.endpoints).map(([groupName, endpoints]) =>
        renderEndpointGroup(groupName, endpoints)
    ).join('')}

    <footer>
        Generated at: ${new Date().toISOString()}
    </footer>
</body>
</html>
    `;
};

// Explicitly export an object with the function
module.exports = { renderApiDocumentation };