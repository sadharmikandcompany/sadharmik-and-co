import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
    rules: {
      // Allow unescaped quotes in JSX
      "react/no-unescaped-entities": "off",
      // Allow any types for existing code
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow unused vars as warnings
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];

export default eslintConfig;
