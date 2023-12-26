import {
	Fetcher,
	Path,
	directoryListingFileSchema
} from './types.js';

import {
	DIRECTORY_LISTING_FILE
} from './constants.js';

class BrowserFetcher {

	writable: false = false as const;

	async fileFetch(path: Path): Promise<string> {
		const response = await fetch(path);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return await response.text();
	}

	async fileExists(path: Path): Promise<boolean> {
		try {
			const response = await fetch(path, { method: 'HEAD' });
			return response.status === 200;
		} catch (e) {
			return false;
		}
	}

	joinPath(...parts: string[]): Path {
		// Assuming the parts are URL segments, this will join them with '/' separators
		return parts.join('/');
	}

	async listSprouts(basePaths: string[] = ['examples', 'sprouts']): Promise<Path[]> {
		//This requires a directory.json file in each folder.
		const result: Path[] = [];
		for (const basePath of basePaths) {
			try {
				const response = await fetch(`${basePath}/${DIRECTORY_LISTING_FILE}`);
				if (!response.ok) {
					continue;
				}
				const json = await response.json();
				const data = directoryListingFileSchema.parse(json);
				for (const sprout of data.directories) {
					result.push(this.joinPath(basePath, sprout));
				}
			} catch (error) {
				console.error(`Error listing sprouts in ${basePath}:`, error);
			}
		}
		return result;
	}
}

//Type to verify we match
const fetcher: Fetcher = new BrowserFetcher();

//Browser fetcher is the default, so we don't need to register ourselves when loaded.

export default fetcher;