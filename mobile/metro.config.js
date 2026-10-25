// metro.config.js — Metro is the tool that bundles the phone app's code.
// By default it only looks inside /mobile. The app's shared "brain" lives one folder up
// in /shared (used by both the website and this app), so we tell Metro to watch it too.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../shared')];

// Packages that /shared imports (like @turf/bbox-clip) are installed here in /mobile, so files in
// /shared must look in this folder's node_modules too.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

// Browser previews only: react-native-maps has no web version, so the web build gets a stand-in.
const resolveRequest = config.resolver.resolveRequest;
const fs = require('fs');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { type: 'sourceFile', filePath: path.resolve(__dirname, 'scripts/web-stubs/react-native-maps.js') };
  }
  try {
    return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  } catch (error) {
    // Files loaded on demand (the Hurricane Helene replays, via import()) are fetched by the dev server
    // with a path from /mobile, like "./shared/scenario/scenarios/helene-arrives". /shared is one folder
    // up, so the plain lookup fails and crashed the dev server. Look for it next to /mobile instead.
    if (moduleName.startsWith('./shared/')) {
      for (const ext of ['', '.json', '.ts', '.tsx', '.js']) {
        const filePath = path.resolve(__dirname, '..', moduleName + ext);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return { type: 'sourceFile', filePath };
      }
    }
    throw error;
  }
};

module.exports = config;
