import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
      files: ["**/*.tsx", "**/*.ts"],
      languageOptions: {
          parserOptions: {
              ecmaFeatures: { jsx: true }
          },
          globals: {
              window: "readonly",
              document: "readonly",
              HTMLElement: "readonly",
              console: "readonly",
              setTimeout: "readonly",
              clearTimeout: "readonly",
              setInterval: "readonly",
              clearInterval: "readonly",
              process: "readonly",
              fetch: "readonly",
              localStorage: "readonly",
              URL: "readonly",
              Blob: "readonly",
              Promise: "readonly"
          }
      },
      rules: {
          "no-undef": "error"
      }
  }
];
