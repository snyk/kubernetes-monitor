// @kubernetes/client-node >=1.0 is ESM-only; jest-runtime's CJS loader can't load it,
// but Node >=22.12's native require() can. Jest patches require('node:module') with its
// own createRequire that still honors moduleNameMapper (which would circularly resolve
// back to this file), so grab the real built-in via process.getBuiltinModule instead.
const { createRequire } = process.getBuiltinModule('node:module');
module.exports = createRequire(__filename)('@kubernetes/client-node');
