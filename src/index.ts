import {
	listSprouts
} from './fetcher.js';

import {
	z
} from 'zod';

import {
	pathSchema
} from './types.js';

import {
	parse
} from 'ts-command-line-args';

import {
	Sprout
} from './sprout.js';

import {
	AIProvider
} from './llm.js';

import {
	env,
	stdout
} from 'process';

import {
	config as dotEnvConfig
} from 'dotenv';

import {
	appendFileSync
} from 'fs';

import enquirer from 'enquirer';

dotEnvConfig();

const cliOptions = z.object({
	sprout: z.optional(pathSchema),
	verbose: z.optional(z.boolean()),
	help: z.optional(z.boolean())
});

type CLIOptions = z.infer<typeof cliOptions>;

const streamLogger = (input : string) : void => {
	stdout.write(input);
};

const IMAGE_MAGIC_STRING = '@image';

//This is not a method on sprout because Sprout doesn't  know how to get or give
//input to the surrounding context.
const runSprout = async (sprout : Sprout, opts : CLIOptions) : Promise<void> => {
	//TODO: allow an exit
	const active = true;
	const sproutConfig = await sprout.config();
	const allowImages = sproutConfig.allowImages || false;
	while(active) {
		const logger = opts.verbose ? console.info : undefined;
		await sprout.conversationTurn(streamLogger, logger);
		//TODO: allow configuring whether a sprout accepts images or not.
		const userInput = await enquirer.prompt<{userResponse:string}>({
			type: 'input',
			name: 'userResponse',
			message: `Your response ${allowImages ? `(include ${IMAGE_MAGIC_STRING} to include an image)` : ''}:`
		});
		let response = userInput.userResponse;
		if (allowImages && response.toLocaleLowerCase().includes(IMAGE_MAGIC_STRING.toLowerCase())) {
			response = response.replace(IMAGE_MAGIC_STRING, 'image');
			//TODO: auto complete.
			const userInput = await enquirer.prompt<{imagePath:string}>({
				type: 'input',
				name: 'imagePath',
				message: 'Path to an image to include:'
			});
			const imagePath = userInput.imagePath;
			console.log(`Image path: ${imagePath}`);
			//TODO: actually pass the image to the sprout.
			console.log('TODO: implement actually providing images to the bot');
		}
		sprout.provideUserResponse(response);
	}

};

const ensureOpenAIAPIKey = async () : Promise<string> => {
	let key = env.OPENAI_API_KEY;
	if (key) return key;
	while (!key) {
		const userInput = await enquirer.prompt<{apiKey: string}>({
			type: 'input',
			name: 'apiKey',
			message: 'Please provide your OPENAI_API_KEY'
		});
		key = userInput.apiKey || '';
	}

	const saveInput = await enquirer.prompt<{save: boolean}>({
		type: 'confirm',
		name: 'save',
		initial: true,
		message: 'Do you want to save this key in a .env file so you don\'t have to provide it again next time?'
	});

	const save = saveInput.save || false;

	if (save) {
		//Prepend a '\n' just in case the env file doesn't end with one. Worst case it will have an extra line.
		appendFileSync('.env', `\nOPENAI_API_KEY=${key}\n`);
	}

	return key;

};

const main = async (opts : CLIOptions) : Promise<void> => {
	
	const OPENAI_API_KEY = await ensureOpenAIAPIKey();

	let sproutName = opts.sprout;
	
	if (!sproutName) {

		const sproutPaths = await listSprouts();
		const input = await enquirer.prompt<{sprout: string}>({
			type: 'select',
			name: 'sprout',
			message: 'Sprout to run',
			choices: sproutPaths
		});
		sproutName = input.sprout;
	}

	if (!sproutName) throw new Error('no sprout provided');

	const ai = new AIProvider({
		openai_api_key: OPENAI_API_KEY
	});
	const sprout = new Sprout(sproutName, ai);
	await sprout.validate();
	await runSprout(sprout, opts);
};

(async() => {
	const opts = parse<CLIOptions>({
		sprout: {
			type: String,
			optional: true,
			defaultOption: true,
			description: 'The sprout to run (path from the current working directory)'
		},
		help: {
			type: Boolean,
			optional: true,
			alias: 'h',
			description: 'Print this usage guide'
		},
		verbose: {
			type: Boolean,
			optional: true,
			alias: 'v',
			description: 'Whether to show debug output'
		}
	}, {
		headerContentSections: [{
			header: 'code-sprout',
			content: 'Runs sprouts'
		}],
		helpArg: 'help'
	});

	await main(opts);
})();