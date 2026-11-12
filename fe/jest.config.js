const nextJest = require("next/jest");

// `next/jest` wires up the SWC transform (so JSX/TS need no extra config), the
// Next.js module aliases, and `.env` loading — the same pipeline `next dev` uses.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  // services/authenticate-user.ts writes its session cookies with `secure: true`.
  // jsdom silently drops those on an http:// document, so the environment has to
  // be served over https or every session assertion reads back `undefined`.
  testEnvironmentOptions: { url: "https://localhost/" },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // Unit tests live under __tests__/. Cypress specs use `.cy.ts` and are excluded
  // so `jest` and `cypress run` never pick up each other's files.
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/*.test.{ts,tsx}"],

  moduleDirectories: ["node_modules", "<rootDir>"],
  moduleNameMapper: {
    // Static assets imported by components under test.
    "\\.(css|less|scss|sass)$": "<rootDir>/__tests__/__mocks__/style-mock.js",
    "\\.(jpg|jpeg|png|gif|webp|svg|mp4)$":
      "<rootDir>/__tests__/__mocks__/file-mock.js",
  },

  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "commonComponents/**/*.{ts,tsx}",
    "services/**/*.{ts,tsx}",
    "model/**/*.{ts,tsx}",
    "utils/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  clearMocks: true,
};

module.exports = createJestConfig(customJestConfig);
