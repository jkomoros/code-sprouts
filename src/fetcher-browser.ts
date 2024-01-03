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

type FetchCacheKey = string;

class BrowserFetcher {

	private _localWriteablePath: Path | null = null;

	//These are previously kicked off fetches that are still in progress, or are already done.
	private _existingFetches: Map<FetchCacheKey, Promise<Response>>;

	constructor() {
		this._existingFetches = new Map();
	}

	private _fetchCacheKey(path: Path, init? : RequestInit): FetchCacheKey {
		const result = [path];
		result.push(init?.method || 'GET');
		return result.join('|');
	}

	private fetch(path : Path, init? : RequestInit) : Promise<Response> {
		const key = this._fetchCacheKey(path, init);
		if (this._existingFetches.has(key)) {
			const basePromise = this._existingFetches.get(key);
			if (!basePromise) throw new Error('Unexpected null basePromise');
			return new Promise(resolve => {
				//Every vended promise with the exception of the first is responsible for cloning the response.
				basePromise.then((response) => {
					resolve(response.clone());
				});
			});
		}
		const promise = new Promise<Response>((resolve, reject) => {
			fetch(path, init).then((response) => {
				//We don't delete the _expectedResponse. In the future if
				//someone fetches it again, they'll get a promise that will
				//resolve immediately.

				//Only the initiator of the actual fetch is allowed to return
				//the response immediately; everyone else must clone it.
				resolve(response);
			}).catch((error) => {
				reject(error);
			});
		});

		this._existingFetches.set(key, promise);
		return promise;
	}

	set localWriteablePath(path: Path) {
		this._localWriteablePath = path;
	}

	get localWriteablePath(): Path {
		return this._localWriteablePath || '';
	}

	pathIsLocalWriteable(path: Path): boolean {
		if (this._localWriteablePath === null) return false;
		return path.startsWith(this._localWriteablePath);
	}

	async fileFetch(path: Path): Promise<string> {
		if (this.pathIsLocalWriteable(path)) {
			return LocalStorageFilesystem.readFile(path);
		}
		path = makeFinalPath(path);
		const response = await this.fetch(path);
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
			const response = await this.fetch(path, { method: 'HEAD' });
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
		const response = await this.fetch(joinPath(path, DIRECTORY_LISTING_FILE));
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
				const response = await this.fetch(`${basePath}/${DIRECTORY_LISTING_FILE}`);
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