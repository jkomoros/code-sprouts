import { zodToJsonSchema } from 'zod-to-json-schema';

import {
	sproutConfigSchema
} from '../src/types.js';

import {
	writeFileSync
} from 'fs';

import path from 'path';

const SCHEMAS_DIR = 'schemas';
const SPROUT_CONFIG_FILE = 'sprout_config.json';

const writeConfig = () => {
	const schema = zodToJsonSchema(sproutConfigSchema);
	const file = path.join(SCHEMAS_DIR, SPROUT_CONFIG_FILE);
	writeFileSync(file, JSON.stringify(schema, null, '\t'));
};

const main = () => {
	writeConfig();
};

(() => {
	main();
})();