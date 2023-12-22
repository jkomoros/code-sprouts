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
	env
} from 'process';

import {
	config as dotEnvConfig
} from 'dotenv';

import enquirer from 'enquirer';

dotEnvConfig();

const cliOptions = z.object({
	sprout: z.optional(pathSchema),
	verbose: z.optional(z.boolean()),
	help: z.optional(z.boolean())
});

type CLIOptions = z.infer<typeof cliOptions>;

//This is not a method on sprout because Sprout doesn't  know how to get or give
//input to the surrounding context.
const runSprout = async (sprout : Sprout, opts : CLIOptions) : Promise<void> => {
	//TODO: allow an exit
	const active = true;
	while(active) {
		const logger = opts.verbose ? console.info : undefined;
		const message = await sprout.conversationTurn(logger);
		console.log(`Bot:\n${message}`);
		//TODO: wait for the user's input, then provide to the prompt, then 
		const userInput = await enquirer.prompt<{userResponse:string}>({
			type: 'input',
			name: 'userResponse',
			message: 'Your response:'
		});
		sprout.provideUserResponse(userInput.userResponse);
	}

};

const main = async (opts : CLIOptions) : Promise<void> => {
	if (opts.sprout) {
		const ai = new AIProvider('openai.com:gpt-4-1106-preview', {
			//TODO: allow specifiying in a secret.CONFIG.json object too.
			openai_api_key: env.OPENAI_API_KEY
		});
		const sprout = new Sprout(opts.sprout, ai);
		await sprout.validate();
		await runSprout(sprout, opts);
		return;
	}
	const sproutPaths = await listSprouts();
	for (const path of sproutPaths) {
		console.log(path);
	}
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