/**
 * Production bundle for the API.
 *
 * `@runway/shared` ships raw TypeScript (`main: src/index.ts`), which Node
 * cannot execute, so the workspace package is bundled into the output rather
 * than left as a runtime import. Prisma stays external: it resolves its own
 * generated client and native query engine from node_modules at runtime.
 */
import {build} from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  external: ['@prisma/client', '.prisma/client'],
  logLevel: 'info',
  // ESM output needs these shims: some CJS dependencies reference `require`
  // and `__dirname` after esbuild converts them.
  banner: {
    js: [
      "import {createRequire as __createRequire} from 'node:module';",
      "import {dirname as __pathDirname} from 'node:path';",
      "import {fileURLToPath as __fileURLToPath} from 'node:url';",
      'const require = __createRequire(import.meta.url);',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __pathDirname(__filename);',
    ].join('\n'),
  },
});
