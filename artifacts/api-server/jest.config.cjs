/**
 * Jest config for the Clone Room services.
 *
 * The package is ESM ("type": "module") but the unit-tested services
 * (seedGen, storyEngine) are pure functions, so we let ts-jest transpile the
 * TypeScript sources to CommonJS for the test run. `isolatedModules` keeps the
 * transform fast and avoids cross-package type resolution during testing.
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
          verbatimModuleSyntax: false,
          isolatedModules: true,
          types: ["node", "jest"],
        },
      },
    ],
  },
};
