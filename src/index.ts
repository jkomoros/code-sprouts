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
import { Sprout } from './sprout.js';

const cliOptions = z.object({
    sprout: z.optional(pathSchema)
});

type CLIOptions = z.infer<typeof cliOptions>;

const main = async (opts : CLIOptions) : Promise<void> => {
    if (opts.sprout) {
        const sprout = new Sprout(opts.sprout);
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

    //TODO: configure help
    const opts = parse<CLIOptions>({
        sprout: {
            type: String,
            optional: true,
            defaultOption: true,
            description: 'The sprout to run (path from the current working directory)'
        }
    });

	await main(opts);
})();