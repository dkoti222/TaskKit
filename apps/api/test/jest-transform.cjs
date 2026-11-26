// Jest transformer: ts-jest, plus a small fix for ES-module-only code in node_modules
// (@nestjs, expo-server-sdk).
//
// Nest 12 ships ES modules. Jest (before Node 24.9) runs everything as CommonJS, so ts-jest
// compiles those files to CommonJS too. A few of them use `import.meta.url`, which doesn't exist
// in CommonJS. For files inside node_modules only, we replace it with the CommonJS equivalent,
// and drop `const require = createRequire(import.meta.url)` because CommonJS already has `require`.
const tsJestFactory = require('ts-jest').default;

const fix = (source, path) =>
  path.includes('/node_modules/')
    ? source
        .replace(/const require = createRequire\(import\.meta\.url\);?/g, '')
        .replace(/import\.meta\.url/g, 'require("url").pathToFileURL(__filename).href')
    : source;

module.exports = {
  createTransformer(options) {
    const tsJest = tsJestFactory.createTransformer(options);
    return {
      canInstrument: tsJest.canInstrument,
      process: (source, path, opts) => tsJest.process(fix(source, path), path, opts),
      processAsync: (source, path, opts) => tsJest.processAsync(fix(source, path), path, opts),
      getCacheKey: (source, path, opts) => tsJest.getCacheKey(fix(source, path), path, opts),
      getCacheKeyAsync: (source, path, opts) =>
        tsJest.getCacheKeyAsync(fix(source, path), path, opts),
    };
  },
};
