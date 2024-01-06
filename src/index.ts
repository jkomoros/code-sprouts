import nodeFetcher from './fetcher-node.js';

import {
	z
} from 'zod';

import {
	ImageURL,
	Prompt,
	SproutState,
	pathSchema
} from './types.js';

import {
	join,
	resolve
} from 'path';

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
	appendFileSync,
	readFileSync
} from 'fs';

import {
	homedir
} from 'os';

import sharp from 'sharp';

import enquirer from 'enquirer';
import { ConversationSignaller } from './signaller.js';

dotEnvConfig();

const cliOptions = z.object({
	sprout: z.optional(pathSchema),
	verbose: z.optional(z.boolean()),
	help: z.optional(z.boolean())
});

type CLIOptions = z.infer<typeof cliOptions>;

const IMAGE_MAGIC_STRING = '@image';

const absoluteFile = (input : string) : string => {
	if (input.startsWith('~')) {
		return join(homedir(), input.slice('~'.length));
	}
	return resolve(input);
};

const resizedImage = async (input : Buffer) : Promise<Buffer> => {
	const resizedImageBuffer = await sharp(input)
		.resize({
			width: 2000,
			height: 2000,
			fit: sharp.fit.inside,
			withoutEnlargement: true
		})
		.toBuffer();

	return resizedImageBuffer;
};

const loadImage = async (imagePath : string) : Promise<ImageURL> => {
	const buffer = readFileSync(absoluteFile(imagePath));
	const resizedBuffer = await resizedImage(buffer);
	const data = resizedBuffer.toString('base64');
	return `data:image/jpeg;base64,${data}`;
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

class NodeConversationSignaller extends ConversationSignaller {

	private _debug : boolean;

	constructor(opts: {debug?: boolean} = {}) {
		super();
		const {debug} = opts;
		this._debug = Boolean(debug);
	}

	override async streamStarted(): Promise<void> {
		//Nothing to do
	}

	async streamStopped(sprout : Sprout, _state: SproutState): Promise<void> {
		const sproutConfig = await sprout.config();
		const allowImages = sproutConfig.allowImages;
		const userInput = await enquirer.prompt<{userResponse:string}>({
			type: 'input',
			name: 'userResponse',
			message: `Your response ${allowImages ? `(include ${IMAGE_MAGIC_STRING} to include an image)` : ''}:`
		});
		let response : Prompt = userInput.userResponse;
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
			const image = await loadImage(imagePath);
			response = [
				response,
				{
					image
				}
			];
		}
	}

	streamIncrementalMessage(sprout : Sprout, message: string): void {
		if (this._debug) return;
		stdout.write(message);
	}

	override streamIncrementalDebugMessage(sprout: Sprout, debugMessage: string): void {
		if (!this._debug) return;
		stdout.write(debugMessage);
	}

}

const main = async (opts : CLIOptions) : Promise<void> => {
	
	const OPENAI_API_KEY = await ensureOpenAIAPIKey();

	let sproutName = opts.sprout;
	
	if (!sproutName) {

		const sproutPaths = await nodeFetcher.listSprouts();
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
		'openai.com': OPENAI_API_KEY
	});
	const debugLogger = opts.verbose ? console.info : undefined;
	const sprout = new Sprout(sproutName, {ai, debugLogger, disallowFormatting: true});
	await sprout.validate();
	//Ensure that we won't have to redo calculations in the future.
	await sprout.compile();
	const signaller = new NodeConversationSignaller({debug: opts.verbose});
	await sprout.run(signaller);
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