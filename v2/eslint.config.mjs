import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Static assets, not source. The MediaPipe wasm glue copied in by scripts/copy-mediapipe-wasm.mjs
    // is 8000-line generated Emscripten output and lints to ~500 findings that are not ours.
    "public/**",
  ]),
]);

export default eslintConfig;
