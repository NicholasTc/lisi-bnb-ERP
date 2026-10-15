import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  ...tseslint.configs.recommended,
  { files: ["**/*.{ts,tsx}"], plugins: { "react-hooks": reactHooks }, rules: reactHooks.configs.recommended.rules },
  globalIgnores([".next/**", ".next-test/**", "next-env.d.ts", "playwright-report/**", "test-results/**", "drizzle/meta/**"]),
]);
