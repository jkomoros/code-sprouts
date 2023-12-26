//A node utility that reads the examples and sprouts directories and generates a list of all the files in them.
import {
	DEFAULT_SPROUT_DIRECTORIES,
	DIRECTORY_LISTING_FILE
} from '../src/constants.js';

import {
	writeFileSync,
	readdirSync
} from 'fs';

const generateDirectoryListing = (path: string): void => {
	const files : string[] = [];
	for (const item of readdirSync(path, {withFileTypes: true})) {
		if (!item.isDirectory()) continue;
		files.push(item.name);
	}

	const outputPath = `${path}/${DIRECTORY_LISTING_FILE}`;
	writeFileSync(outputPath, JSON.stringify(files, null, '\t'));
	
};

const main = () : void => {
	for (const dir of DEFAULT_SPROUT_DIRECTORIES) {
		generateDirectoryListing(dir);
	}
};

(async () => {
	main();
})();