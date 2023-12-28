import {
	Fetcher,
	Path,
	directoryListingFileSchema
} from './types.js';

import {
	DIRECTORY_LISTING_FILE
} from './constants.js';

const makeFinalPath = (path : Path) : Path => {
	const parts = path.split('/');
	if (parts.length == 0) return path;
	const firstPart = parts[0];
	if (firstPart.includes('.')) {
		//We'll assume the path is a URL
		return 'https://' + path;
	}
	return path;
};

class BrowserFetcher {

	writable: false = false as const;

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

	joinPath(...parts: string[]): Path {
		// Assuming the parts are URL segments, this will join them with '/' separators
		return parts.join('/');
	}

	async listDirectory(path: Path): Promise<Path[]> {
		path = makeFinalPath(path);
		const response = await fetch(this.joinPath(path, DIRECTORY_LISTING_FILE));
		if (!response.ok) throw new Error(`Could not list directory ${path}`);
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