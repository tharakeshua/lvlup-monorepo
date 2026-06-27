// Metro config for the pnpm monorepo + NativeWind.
// - watchFolders: workspace root so Metro sees the symlinked @levelup/* packages.
// - nodeModulesPaths: resolve from both the app and the hoisted root store.
// - unstable_enablePackageExports: the @levelup/* + firebase packages ship an
//   `exports` map (types/import/require); Metro must honor it to pick the ESM dist.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = false;
// Defense-in-depth: pin nativewind + css-interop to the app-local copy so a stray
// loose install elsewhere in the workspace store can never inject a 2nd context copy
// (root cause of the "Couldn't find a navigation context" RedBox).
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  nativewind: path.resolve(projectRoot, "node_modules/nativewind"),
  "react-native-css-interop": path.resolve(projectRoot, "node_modules/react-native-css-interop"),
};
config.resolver.unstable_enablePackageExports = true;
// Prefer the RN/import conditions; fall back to require for CJS-only deps.
config.resolver.unstable_conditionNames = ["react-native", "import", "require", "default"];

module.exports = withNativeWind(config, { input: "./src/global.css" });
