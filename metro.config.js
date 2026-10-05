const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite na Web (wa-sqlite) precisa carregar o .wasm como asset.
config.resolver.assetExts.push('wasm');

// Cabecalhos exigidos pelo SharedArrayBuffer (usado pelo SQLite Web) no servidor de desenvolvimento.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
