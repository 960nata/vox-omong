import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

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
    ".tools/**",
    ".data/**",
    "skills/**",
    "scripts/**",
    "electron/**",
    // keluaran & staging shell desktop (berisi salinan build + node_modules)
    "dist-desktop/**",
    ".vox-desktop/**",
  ]),
  {
    // Flat config memakai namespace plugin per objek config: rule `react-hooks/*` di bawah
    // hanya dikenali kalau pluginnya didaftarkan di objek yang sama ini.
    plugins: { "react-hooks": reactHooks },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
