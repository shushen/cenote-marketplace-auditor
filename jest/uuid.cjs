'use strict';

const { randomUUID } = require('node:crypto');

// TypeORM requires uuid via CommonJS; uuid v14+ is ESM-only.
module.exports = {
    v4: randomUUID,
};
