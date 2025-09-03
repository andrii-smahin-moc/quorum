import { defineConfig } from 'tsup';

// export default defineConfig({
//   clean: true,
//   entry: ['src/function.ts'],
//   // Uncomment the following line to enable bundling node_modules
//   // noExternal: [/.*/],
// });

export default defineConfig({
  clean: true,
  entry: ['src/function.ts'],
  // esbuildOptions(options) {
  //   // eslint-disable-next-line no-param-reassign
  //   options.banner = {
  //     js: 'export {}', // ensure top-level ESM context
  //   };
  // },
  format: ['esm'], // force ESM output
  outExtension: () => ({ js: '.js' }), // ensures .js output even for ESM
  target: 'esnext', // match your tsconfig
  noExternal: [/.*/],
});
