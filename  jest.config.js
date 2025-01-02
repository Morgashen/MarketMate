module.exports = {
    transform: {
        "^.+\\.[tj]sx?$": "babel-jest", // Use Babel to transform test files
    },
    transformIgnorePatterns: [
        "/node_modules/(?!chai|chai-http)", // Transform ES Modules in chai and chai-http
    ],
    testEnvironment: "node", // Use Node.js environment for tests
    moduleFileExtensions: ["js", "jsx", "json", "node"],
};  