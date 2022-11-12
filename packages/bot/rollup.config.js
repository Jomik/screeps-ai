'use strict';

import dotenv from 'dotenv';
dotenv.config();

import clear from 'rollup-plugin-clear';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import screeps from 'rollup-plugin-screeps';

let cfg;
const dest = process.env.DEST;
if (!dest) {
  console.log(
    'No destination specified - code will be compiled but not uploaded'
  );
} else if ((cfg = require('./screeps.json')[dest]) == null) {
  throw new Error('Invalid upload destination');
}

if (cfg && dest) {
  const Prefix = `SCREEPS_${dest.toUpperCase()}_`;
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(Prefix)) {
      continue;
    }
    cfg[key.slice(Prefix.length).toLowerCase()] = value;
  }

  if (!cfg.token && !(cfg.email && cfg.password)) {
    throw new Error('Missing token, or email and password');
  }
}

export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/main.js',
    format: 'cjs',
    sourcemap: true,
  },

  plugins: [
    clear({ targets: ['dist'] }),
    resolve({ rootDir: 'src', preferBuiltins: false }),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' }),
    screeps({ config: cfg, dryRun: cfg == null }),
  ],
};
