import { zodToJsonSchema } from 'zod-to-json-schema';

import {
	compiledSproutSchema,
	sproutConfigSchema
} from '../src/types.js';

import {
	writeFileSync
} from 'fs';

import path from 'path';

const SCHEMAS_DIR = 'schemas';
const SPROUT_CONFIG_FILE = 'sprout_config.json';
const COMPILED_SPROUT_FILE = 'compiled_sprout.json';

const writeConfig = () => {
	const schema = zodToJsonSchema(sproutConfigSchema);
	const file = path.join(SCHEMAS_DIR, SPROUT_CONFIG_FILE);
	writeFileSync(file, JSON.stringify(schema, null, '\t'));
};

const writeCompiled = () => {
	const schema = zodToJsonSchema(compiledSproutSchema);
	const file = path.join(SCHEMAS_DIR, COMPILED_SPROUT_FILE);
	writeFileSync(file, JSON.stringify(schema, null, '\t'));
};

const main = () => {
	writeConfig();
	writeCompiled();
};

(() => {
	main();
})();