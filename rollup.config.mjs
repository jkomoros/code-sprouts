import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import pkg from 'rollup-plugin-minify-html-literals';
const { default: minifyHTML } = pkg;
import copy from 'rollup-plugin-copy';
import commonjs from '@rollup/plugin-commonjs';
import summary from 'rollup-plugin-summary';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';

export default {
	input: 'build/app/components/my-app.js',
	output: {
		dir: 'build/app/components',
		format: 'es',
	},
	plugins: [
		minifyHTML(),
		dynamicImportVars(),
		copy({
			targets: [
				{ src: 'images', dest: 'build' },
				{ src: 'fonts', dest: 'build' },
				{ src: 'manifest.json', dest: 'build' },
				{ src: 'index.html', dest: 'build' },
				{ src: 'examples', dest: 'build' },
				{ src: 'sprouts', dest: 'build' }
			],
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