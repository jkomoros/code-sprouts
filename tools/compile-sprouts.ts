//A node utility that compiles any sprouts that need it.
import nodeFetcher from '../src/fetcher-node.js';

import {
	Sprout
} from '../src/sprout.js';

import {
	AIProvider
} from '../src/llm.js';

import {
	config as dotEnvConfig
} from 'dotenv';

import {
	writeFileSync
} from 'fs';

import {
	join
} from 'path';

import {
	SPROUT_COMPILED_PATH
} from '../src/constants.js';

dotEnvConfig();

const compileSprout = async (sproutPath: string, aiProvider : AIProvider): Promise<void> => {
	const sprout = new Sprout(sproutPath, {ai: aiProvider, debugLogger: console.log});
	const needsCompilation = await sprout.requiresCompilation();
	if (!needsCompilation) {
		console.log(`Skipping ${sproutPath} because it is already compiled.`);
		return;
	}
	console.log(`Compiling ${sproutPath}`);
	//Since we have a writeFetcher, we can compile the sprout in place.
	const data = await sprout.compiledData(true);
	const path = join(sproutPath, SPROUT_COMPILED_PATH);
	writeFileSync(path, JSON.stringify(data, null, '\t'));
};

const main = async () : Promise<void> => {
	const openAIAPIKey = process.env.OPENAI_API_KEY;
	if (!openAIAPIKey) throw new Error('OPENAI_API_KEY environment variable must be set (.env is OK).');
	const ai = new AIProvider({
		'openai.com': openAIAPIKey
	});
	for (const sproutPath of await nodeFetcher.listSprouts()) {
		compileSprout(sproutPath, ai);
	}
};

(async () => {
	await main();
})();