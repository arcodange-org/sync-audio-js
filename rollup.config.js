import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.js',
  output: [
    { file: 'dist/index.js', format: 'umd', name: 'SyncAudio' },
    { file: 'dist/index.esm.js', format: 'esm' }
  ],
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' }),
    terser()
  ]
};
