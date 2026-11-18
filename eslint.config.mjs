import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "db/**",
      "out/**",
      "public/pdf.worker.min.mjs",
      "scripts/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
