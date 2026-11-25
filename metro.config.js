const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql'); // drizzle migrations

// server/ is a separate Node package (Postgres); keep it out of the app bundle.
const serverDir = path.join(__dirname, 'server').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [...[config.resolver.blockList].flat(), new RegExp(`^${serverDir}[\\\\/].*`)];

// three's CJS build calls Node's process.emitWarning, which React Native lacks; use its ESM build instead.
const threeModule = path.join(__dirname, 'node_modules/three/build/three.module.js');
config.resolver.resolveRequest = (context, name, platform) =>
  name === 'three' ? { type: 'sourceFile', filePath: threeModule } : context.resolveRequest(context, name, platform);
module.exports = config;
