import {
	Fetcher,
	FileListingType,
	Path,
	directoryListingFileSchema
} from './types.js';

import {
	DEFAULT_SPROUT_DIRECTORIES,
	DIRECTORY_LISTING_FILE
} from './constants.js';

import {
	assertUnreachable,
	joinPath,
	makeFinalPath
} from './util.js';

import {
	LocalStorageFilesystem
} from './local_storage_filesystem.js';

type FetchCacheKey = string;

//5 minutes
const CACHE_EXPIRATION = 1000 * 60 * 5;

export class BrowserFetcher {

	private _localWriteablePath: Path | null = null;

	//These are previously kicked off fetches that are still in progress, or are already done.
	private _existingFetches: Map<FetchCacheKey, {promise?: Promise<void>, response? : Response, timestamp: Date}>;
	private _cacheTimeoutID : number | null = null;

	constructor() {
		this._existingFetches = new Map();

	}

	private _clearExpiredFetches() {
		this._cacheTimeoutID = null;
		for (const [key, value] of this._existingFetches.entries()) {
			if (value.timestamp.getTime() + CACHE_EXPIRATION < Date.now()) {
				this._existingFetches.delete(key);
			}
		}
		this._startCacheTimeout();
	}

	private _startCacheTimeout() {
		if (this._cacheTimeoutID !== null) return;
		if (this._existingFetches.size > 0) {
			this._cacheTimeoutID = window.setTimeout(() => {
				this._clearExpiredFetches();
			}, CACHE_EXPIRATION);
		}
	}

	private _fetchCacheKey(path: Path, init? : RequestInit): FetchCacheKey {
		const result = [path];
		result.push(init?.method || 'GET');
		return result.join('|');
	}

	private fetch(path : Path, init? : RequestInit) : Promise<Response> {
		const key = this._fetchCacheKey(path, init);
		if (!this._existingFetches.has(key)) {
			this._startCacheTimeout();
			const promise = new Promise<void>((resolve, reject) => {
				fetch(path, init).then((response) => {
					//We don't delete the _expectedResponse. In the future if
					//someone fetches it again, they'll get a promise that will
					//resolve immediately.
	
					//Store the original response so others can clone it.
					const value = this._existingFetches.get(key);
					if (!value) throw new Error('Unexpected null value');
					value.response = response;
					//We'll be vending multiple copies so we need to clone it. (You
					//can't clone after already having read body).
					resolve();
				}).catch((error) => {
					reject(error);
				});
			});
	
			this._existingFetches.set(key, {promise, timestamp : new Date()});
		}
		

		const basePromise = this._existingFetches.get(key);
		if (!basePromise) throw new Error('Unexpected null basePromise');
		if (basePromise.response) { 
			return Promise.resolve(basePromise.response.clone());
		}	
		return new Promise(resolve => {
			//Every vended promise with the exception of the first is responsible for cloning the response.
			if (!basePromise.promise) throw new Error('Unexpected null basePromise.promise');
			basePromise.promise.then(() => {
				const value = this._existingFetches.get(key);
				if (!value) throw new Error('Unexpected null value');
				if (!value.response) throw new Error('Unexpected null value.response');
				resolve(value.response.clone());
			});
		});
	}

	get writeable() : boolean {
		return false;
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

	async listDirectory(path: Path, type: FileListingType): Promise<Path[]> {
		if (this.pathIsLocalWriteable(path)) {
			return LocalStorageFilesystem.listDirectory(path, type);
		}
		path = makeFinalPath(path);
		const response = await this.fetch(joinPath(path, DIRECTORY_LISTING_FILE));
		if (!response.ok) return [];
		const json = await response.json();
		const data = directoryListingFileSchema.parse(json);
		switch (type) {
		case 'both':
			return [...data.directories, ...data.files];
		case 'directory':
			return data.directories;
		case 'file':
			return data.files;
		default:
			return assertUnreachable(type);
		}
	}

	async listSprouts(): Promise<Path[]> {
		const basePaths = this._localWriteablePath ? [this._localWriteablePath, ...DEFAULT_SPROUT_DIRECTORIES] : DEFAULT_SPROUT_DIRECTORIES;
		//This requires a directory.json file in each folder.
		const result: Path[] = [];
		for (let basePath of basePaths) {
			if (this.pathIsLocalWriteable(basePath)) {
				const items = LocalStorageFilesystem.listDirectory(basePath, 'directory');
				for (const item of items) {
					result.push(joinPath(basePath, item));
				}
				continue;
			}
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
}

//Type to verify we match
const fetcher: Fetcher = new BrowserFetcher();

//Browser fetcher is the default, so we don't need to register ourselves when loaded.

export default fetcher;