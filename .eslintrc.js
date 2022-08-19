module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "quotes": ["error", "double"],
    "max-len": "off",
    "valid-jsdoc": "warn",
    "prefer-destructuring": ["error", {
      "array": true,
      "object": true,
    }, {
      "enforceForRenamedProperties": false,
    }],
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
};
