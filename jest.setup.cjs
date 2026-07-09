// Enable source map support
require('source-map-support').install({
    environment: 'node',
    handleUncaughtExceptions: false,
    retrieveSourceMap: function(source) {
        if (source.indexOf('node_modules') > -1) {
            return null;
        }
        return null;
    }
});

// Configure Node.js to use source maps
process.env.NODE_OPTIONS = '--enable-source-maps --require source-map-support/register';

// MarketplaceHttpClient logs retry warnings in production; silence them in tests.
const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
    const first = args[0];
    if (typeof first === 'string' && first.startsWith('[marketplace-http]')) {
        return;
    }
    originalConsoleWarn(...args);
};
