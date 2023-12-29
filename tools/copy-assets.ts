import {
	z
} from 'zod';

import {
	readFileSync,
	existsSync,
	statSync,
	mkdirSync,
	readdirSync,
	copyFileSync
} from 'fs';

import {
	basename,
	join
} from 'path';

const CONFIG_PATH = 'assets.json';
const DEFAULT_DEST = 'build';

const configSchema = z.array(z.string());

type Config = z.infer<typeof configSchema>;


export const loadConfig = (configPath = CONFIG_PATH) : Config => {
	return configSchema.parse(JSON.parse(readFileSync(configPath).toString()));
};

const copyPath = (sourcePath: string, dest = DEFAULT_DEST) => {
	//Copy the file or directory to the same location but in dest.
	//If the path is a directory, copy all of its contents recursively.
	//If the path is a file, copy it.
	
	// Check if the source path exists
	if (!existsSync(sourcePath)) {
		console.error('Source path does not exist:', sourcePath);
		return;
	}

	// Get the name of the source file or directory
	const sourceName = basename(sourcePath);
	// Create a destination path
	const destPath = join(dest, sourceName);

	// Check if the source path is a file or a directory
	const stat = statSync(sourcePath);
	if (stat.isDirectory()) {
		// Create the destination directory if it doesn't exist
		if (!existsSync(destPath)) {
			mkdirSync(destPath, { recursive: true });
		}

		// Read all files and directories within the source directory
		readdirSync(sourcePath).forEach(fileOrDir => {
			// Recursive call to copy each file/directory
			copyPath(join(sourcePath, fileOrDir), destPath);
		});
	} else if (stat.isFile()) {
		// Copy the file
		copyFileSync(sourcePath, destPath);
	}
};

const main = () => {
	const config = loadConfig();
	for (const path of config) {
		copyPath(path);
	}
};

(() => {
	main();
})();