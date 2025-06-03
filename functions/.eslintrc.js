module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
    ecmaVersion: 2020, // Added for modern syntax compatibility
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    "object-curly-spacing": ["error", "never"], // Enforce no space after { and before }
    "require-jsdoc": 0, // Disabled for this example as JSDoc is not the focus
    "@typescript-eslint/no-explicit-any": "warn", // Warn instead of error for 'any'
    "max-len": ["warn", {"code": 120}], // Warn for lines longer than 120 chars
    "no-dupe-class-members": "off", // Allow constructor overloads etc.
    "@typescript-eslint/no-dupe-class-members": ["error"]
  },
};
