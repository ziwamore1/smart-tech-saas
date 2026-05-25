const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro resolves scoped packages correctly
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
