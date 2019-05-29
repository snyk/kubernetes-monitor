// duplicated here from src/lib/config so we don't need explicit Typescript
// compilation in tests
const config = require('snyk-config')(__dirname, {
  secretConfig: process.env.CONFIG_SECRET_FILE,
});

module.exports.config = config.NEWRELIC;
