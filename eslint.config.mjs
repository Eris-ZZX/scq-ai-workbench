import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The compatibility-preserving database gateway accepts legacy-shaped
      // query objects while every route is switched to the Drizzle runtime.
      "@typescript-eslint/no-explicit-any": "off",
      // Existing client components intentionally hydrate URL/local-storage
      // state in effects; this refactor does not redesign their UI state model.
      "react-hooks/set-state-in-effect": "off",
      // Existing server pages translate authorization failures to notFound().
      "react-hooks/error-boundaries": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "quality-workbench-app/**",
    "00-docs/**",
    "01-prototypes/**",
    ".vibe/**",
    "drizzle/**",
    "db/schema.generated.ts",
    "db/model-metadata.generated.ts",
  ]),
]);

export default eslintConfig;
