// Deliberately CommonJS rather than next.config.ts.
//
// The Firebase frameworks packager transpiles a .ts config with esbuild in CJS
// mode, which emits `module.exports = {__esModule: true, default: {...}}`. The
// deployed server then reads that wrapper instead of the settings and logs
// "Unrecognized key(s) in object: '__esModule', 'default'" on every cold start,
// silently ignoring the whole config at runtime.
//
// A plain .js config is copied as-is, so what runs in production is what is
// written here. JSDoc keeps editor type-checking.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  trailingSlash: false,
}

module.exports = nextConfig
