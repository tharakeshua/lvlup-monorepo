// pnpm-monorepo fix: expo-modules-autolinking's react-native-config resolver
// derives expo's packageImportPath from the gradle namespace ("expo.core") +
// the class basename ("ExpoModulesPackage"), yielding the WRONG
// `import expo.core.ExpoModulesPackage;`. The class actually lives in
// `expo.modules`. Expo's own react-native.config.js sets the correct path but
// isn't picked up under pnpm, so we override the expo dependency explicitly.
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: "import expo.modules.ExpoModulesPackage;",
          packageInstance: "new ExpoModulesPackage()",
        },
      },
    },
  },
};
