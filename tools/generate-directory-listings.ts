//A node utility that reads the examples and sprouts directories and generates a list of all the files in them.
import {
	DEFAULT_SPROUT_DIRECTORIES,
	DIRECTORY_LISTING_FILE
} from '../src/constants.js';

import {
	writeFileSync,
	readdirSync
} from 'fs';

import {
	DirectoryListingFile
} from '../src/types.js';

const generateDirectoryListing = (path: string): void => {
	const directories : string[] = [];
	const files : string[] = [];
	for (const item of readdirSync(path, {withFileTypes: true})) {
		if (item.name == DIRECTORY_LISTING_FILE) continue;
		if (!item.isDirectory()) {
			files.push(item.name);
			continue;
		}
		directories.push(item.name);
		generateDirectoryListing(`${path}/${item.name}`);
	}

	const outputPath = `${path}/${DIRECTORY_LISTING_FILE}`;
	const data : DirectoryListingFile = {
		directories,
		files
	};
	writeFileSync(outputPath, JSON.stringify(data, null, '\t'));
	
};

const main = () : void => {
	for (const dir of DEFAULT_SPROUT_DIRECTORIES) {
		generateDirectoryListing(dir);
	}
};

(async () => {
	main();
})();