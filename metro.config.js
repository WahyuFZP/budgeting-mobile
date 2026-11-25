const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql'); // drizzle migrations

// server/ is a separate Node package (Postgres); keep it out of the app bundle.
const serverDir = path.join(__dirname, 'server').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [...[config.resolver.blockList].flat(), new RegExp(`^${serverDir}[\\\\/].*`)];
module.exports = config;
