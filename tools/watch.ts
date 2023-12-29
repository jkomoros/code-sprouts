import {
	z
} from 'zod';

import {
	watch
} from 'chokidar';

import {
	loadConfig
} from './copy-assets.js';

import {
	minimatch
} from 'minimatch';

import {
	DIRECTORY_LISTING_FILE, SPROUT_COMPILED_PATH
} from '../src/constants.js';

import {
	exec
} from 'child_process';

//Command to run
const commandNameSchema = z.string();
//Paths to watch and rereun command
const commandSchema = z.object({
	include: z.array(z.string()),
	exclude: z.array(z.string()).optional()
});

const watchConfigSchema = z.object({
	rules: z.record(commandNameSchema, commandSchema)
});

type WatchConfig = z.infer<typeof watchConfigSchema>;

const assetConfig = loadConfig();

const CONFIG : WatchConfig = {
	rules: {
		'npm run generate:listings': {
			include: [
				'sprouts/**',
				'examples/**'
			],
			exclude: [
				'**/' + DIRECTORY_LISTING_FILE
			]
		},
		'npm run generate:sprouts': {
			include: [
				'sprouts/**',
				'examples/**'
			],
			exclude: [
				'**/' + SPROUT_COMPILED_PATH,
				'**/' + DIRECTORY_LISTING_FILE
			]
		},
		'npm run build:copy': {
			include: assetConfig
		}
	}
};

const pathChanged = (path : string, config :WatchConfig) => {
	//TODO: batch up path changes
	console.log(`Path ${path} changed`);
	for (const [command, rules] of Object.entries(config.rules)) {

		for (const rule of rules.include) {
			//If rule does not match path (using globbing match), continue
			if (!minimatch(path, rule)) continue;

			let skip = false;

			if (rules.exclude) {
				for (const exclude of rules.exclude) {
					if (minimatch(path, exclude)) {
						console.log(`Path ${path} matches exclude rule ${exclude} for \`${command}\`, skipping`);
						skip = true;
						break;
					}
				}
			}
			
			if (skip) break;

			console.log(`Running \`${command}\` because ${path} changed`);

			exec(command, (error, stdout, stderr) => {
				if (error) {
					console.error(`Execution error: ${command}: ${error.message}`);
					return;
				}
				if (stderr) {
					console.error(`Error: ${command}: ${stderr}`);
					return;
				}
				console.log(`Output: ${command}: ${stdout}`);
			});

			//We only need to find a single match to run the command
			break;
		}
	}
};


const main = () => {
	const config = CONFIG;
	//Watch a random file at start
	const watcher = watch('tsconfig.json', {persistent: true});
	for (const rules of Object.values(config.rules)) {
		watcher.add(rules.include);
	}

	let ready = false;

	watcher.on('ready', () => ready = true);

	watcher.on('all', (event, path) => {
		//Only look at changes
		if (!ready) return;
		pathChanged(path, config);
	});
};

(() => {
	main();
})();