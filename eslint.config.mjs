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
  ]),
  // File test dung CommonJS co chu dich (vm.runInNewContext de require code
  // TypeScript da transpile), khong phai loi thieu chuyen doi sang import.
  {
    files: ["tests/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Anh dong (blob/data URL, URL luu trong DB co the tro toi domain bat ky)
  // va trang demo dung duong dan tuong doi: next/image khong phu hop hoac
  // gay chi phi toi uu anh, nen giu the <img> co chu dich.
  {
    files: [
      "app/page.tsx",
      "app/customer-details/page.tsx",
      "app/marketing/page.tsx",
      "app/portfolio/page.tsx",
      "app/demo-home/page.tsx",
      "app/demo-pro/page.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
