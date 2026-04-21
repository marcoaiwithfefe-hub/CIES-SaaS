import next from 'eslint-config-next';
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'src/app/layout.tsx',
      'src/components/layout/Sidebar.tsx',
    ],
  },
  ...next,
  ...coreWebVitals,
  ...typescript,
];
