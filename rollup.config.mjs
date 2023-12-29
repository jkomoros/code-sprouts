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
		dir: 'dist/app/components',
		format: 'es',
	},
	plugins: [
		minifyHTML(),
		dynamicImportVars(),
		copy({
			targets: [
				{ src: 'images', dest: 'dist' },
				{ src: 'fonts', dest: 'dist' },
				{ src: 'manifest.json', dest: 'dist' },
				{ src: 'index.html', dest: 'dist' },
				{ src: 'examples', dest: 'dist' },
				{ src: 'sprouts', dest: 'dist' }
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