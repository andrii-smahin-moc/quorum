import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  entry: ['src/function.ts'],
  format: ['esm'],
  outExtension: () => ({ js: '.js' }),
  target: 'esnext',
  bundle: true,
  sourcemap: false,
  external: ['ai'],
  noExternal: ['valibot'],
  esbuildOptions(options) {
    options.legalComments = 'none';
    options.minify = false;
    options.minifyWhitespace = true;
    options.minifySyntax = true;
    options.minifyIdentifiers = false;
  },
});
