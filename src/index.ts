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

const cliOptions = z.object({
    sprout: z.optional(pathSchema),
    help: z.optional(z.boolean())
});

type CLIOptions = z.infer<typeof cliOptions>;

const main = async (opts : CLIOptions) : Promise<void> => {
    if (opts.sprout) {
        const ai = new AIProvider('openai.com:gpt-4', {
            //TODO: allow specifiying in a secret.CONFIG.json object too.
            openai_api_key: env.OPENAI_API_KEY
        });
        const sprout = new Sprout(opts.sprout, ai);
        await sprout.validate();
        console.log(await sprout.prompt());
        return;
    }
    const sproutPaths = await listSprouts();
    for (const path of sproutPaths) {
        console.log(path);
    }
}

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