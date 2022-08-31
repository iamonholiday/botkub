module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
    mocha: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "quotes": ["error", "double"],
    "max-len": "off",
    "valid-jsdoc": "warn",
    "require-jsdoc": "warn",
    "prefer-destructuring": ["error", {
      "array": true,
      "object": true,
    }, {
      "enforceForRenamedProperties": false,
    }],
    "no-prototype-builtins": "off",

  },
  parserOptions: {
    "ecmaVersion": 2020,
    "sourceType": "module",
  },
};
