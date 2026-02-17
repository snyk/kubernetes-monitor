// Used by Jest to transpile ESM in @kubernetes/client-node to CommonJS.
module.exports = {
    presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
  