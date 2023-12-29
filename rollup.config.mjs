import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import pkg from 'rollup-plugin-minify-html-literals';
const { default: minifyHTML } = pkg;
import copy from 'rollup-plugin-copy';
import commonjs from '@rollup/plugin-commonjs';
import summary from 'rollup-plugin-summary';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';

//Load up assets.json and parse it
import {
	readFileSync
} from 'fs';

const assets = JSON.parse(readFileSync('assets.json').toString());

const finalAssets = assets.map((asset) => {
	return {
		src: asset,
		dest: 'dist'
	};
});

export default {
	input: 'build/app/components/my-app.js',
	output: {
		dir: 'dist/app/components',
		format: 'es',
	},
	plugins: [
		minifyHTML(),
		dynamicImportVars(),
		copy({
			targets: finalAssets,
		}),
		resolve(),
		terser({
			format: {
				comments: false,
			}
		}),
		commonjs(),
		summary(),
	],
	preserveEntrySignatures: 'strict',
};