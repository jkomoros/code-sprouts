import {
	Fetcher,
	Path,
	directoryListingFileSchema
} from './types.js';

import {
	DIRECTORY_LISTING_FILE
} from './constants.js';

import {
	joinPath,
	makeFinalPath
} from './util.js';

class BrowserFetcher {

	async fileFetch(path: Path): Promise<string> {
		path = makeFinalPath(path);
		const response = await fetch(path);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return await response.text();
	}

	async fileExists(path: Path): Promise<boolean> {
		path = makeFinalPath(path);
		try {
			const response = await fetch(path, { method: 'HEAD' });
			return response.status === 200;
		} catch (e) {
			return false;
		}
	}

	async listDirectory(path: Path): Promise<Path[]> {
		path = makeFinalPath(path);
		const response = await fetch(joinPath(path, DIRECTORY_LISTING_FILE));
		if (!response.ok) return [];
		const json = await response.json();
		const data = directoryListingFileSchema.parse(json);
		return data.directories;
	}

	async listSprouts(basePaths: string[] = ['examples', 'sprouts']): Promise<Path[]> {
		//This requires a directory.json file in each folder.
		const result: Path[] = [];
		for (let basePath of basePaths) {
			basePath = makeFinalPath(basePath);
			try {
				const response = await fetch(`${basePath}/${DIRECTORY_LISTING_FILE}`);
				if (!response.ok) {
					continue;
				}
				const json = await response.json();
				const data = directoryListingFileSchema.parse(json);
				for (const sprout of data.directories) {
					result.push(joinPath(basePath, sprout));
				}
			} catch (error) {
				console.error(`Error listing sprouts in ${basePath}:`, error);
			}
		}
		return result;
	}

	mayWriteFile(_path: Path): boolean {
		return false;
	}

	writeFile(_path: Path, _data: string): Promise<void> {
		throw new Error('Cannot write file in browser');
	}

	supportsLastUpdated() : boolean {
		return false;
	}

	async fileLastUpdated(_path : Path): Promise<Date | null> {
		return null;
	}
}

//Type to verify we match
const fetcher: Fetcher = new BrowserFetcher();

//Browser fetcher is the default, so we don't need to register ourselves when loaded.

export default fetcher;