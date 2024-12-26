const config = {
    testEnvironment: 'node',
    verbose: true,
    forceExit: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
    setupFilesAfterEnv: ['./jest.setup.js']
};

module.exports = config;