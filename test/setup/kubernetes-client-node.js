// @kubernetes/client-node is ESM-only and Jest's CommonJS module registry cannot load it.
// Load it through Node's own require instead, which supports require(esm) on Node >= 22.12.
// process.getBuiltinModule bypasses Jest's patched `module` so createRequire is the real one.
const { createRequire } = process.getBuiltinModule('module');

module.exports = createRequire(__filename)('@kubernetes/client-node');
