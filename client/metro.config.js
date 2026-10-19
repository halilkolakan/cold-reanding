const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// glb ve gltf uzantılarını assetExts dizisine ekliyoruz
config.resolver.assetExts.push('glb', 'gltf');

module.exports = withNativeWind(config, { input: './global.css' });