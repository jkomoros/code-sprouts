import {
	Fetcher,
	Path,
	directoryListingFileSchema
} from './types.js';

import {
	DEFAULT_SPROUT_DIRECTORIES,
	DIRECTORY_LISTING_FILE
} from './constants.js';

import {
	joinPath,
	makeFinalPath
} from './util.js';

import {
	LocalStorageFilesystem
} from './local_storage_filesystem.js';

class BrowserFetcher {

	private _localWriteablePath: Path | null = null;

	set localWriteablePath(path: Path) {
		this._localWriteablePath = path;
	}

	get localWriteablePath(): Path {
		return this._localWriteablePath || '';
	}

	private pathIsLocalWriteable(path: Path): boolean {
		if (this._localWriteablePath === null) return false;
		return path.startsWith(this._localWriteablePath);
	}

	async fileFetch(path: Path): Promise<string> {
		if (this.pathIsLocalWriteable(path)) {
			return LocalStorageFilesystem.readFile(path);
		}
		path = makeFinalPath(path);
		const response = await fetch(path);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return await response.text();
	}

	async fileExists(path: Path): Promise<boolean> {
		if (this.pathIsLocalWriteable(path)) {
			return LocalStorageFilesystem.fileExists(path);
		}
		path = makeFinalPath(path);
		try {
			const response = await fetch(path, { method: 'HEAD' });
			return response.status === 200;
		} catch (e) {
			return false;
		}
	}

	async listDirectory(path: Path): Promise<Path[]> {
		if (this.pathIsLocalWriteable(path)) {
			return LocalStorageFilesystem.listDirectory(path);
		}
		path = makeFinalPath(path);
		const response = await fetch(joinPath(path, DIRECTORY_LISTING_FILE));
		if (!response.ok) return [];
		const json = await response.json();
		const data = directoryListingFileSchema.parse(json);
		return data.directories;
	}

	async listSprouts(basePaths: string[] = DEFAULT_SPROUT_DIRECTORIES): Promise<Path[]> {
		if (basePaths === DEFAULT_SPROUT_DIRECTORIES) {
			if (this._localWriteablePath) {
				basePaths = [this._localWriteablePath, ...DEFAULT_SPROUT_DIRECTORIES];
			}
		}
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

	mayWriteFile(path: Path): boolean {
		if (this.pathIsLocalWriteable(path)) {
			return true;
		}
		return false;
	}

	async writeFile(path: Path, data: string): Promise<void> {
		if (this.pathIsLocalWriteable(path)) {
			return LocalStorageFilesystem.writeFile(path, data);
		}
		throw new Error('Cannot write file in browser outside of local writeable path');
	}

	supportsLastUpdated() : boolean {
		if (this._localWriteablePath) return true;
		return false;
	}

	async fileLastUpdated(path : Path): Promise<Date | null> {
		if (this.pathIsLocalWriteable(path)) {
			return LocalStorageFilesystem.lastUpdated(path);
		}
		return null;
	}
}

//Type to verify we match
const fetcher: Fetcher = new BrowserFetcher();

//Browser fetcher is the default, so we don't need to register ourselves when loaded.

export default fetcher;