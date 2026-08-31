import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "**/node_modules/**",
    ".next/**",
    ".next/standalone/**",
    "out/**",
    "build/**",
    "dist/**",
    "desktop/dist/**",
    "htn-api-ref/**",
    "data/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
