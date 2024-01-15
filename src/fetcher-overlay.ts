import {
	DirectoryInfo,
	Fetcher,
	FetcherWithoutListSprouts,
	FileListingType,
	Path
} from './types.js';

import {
	listDirectoryFromDirectoryInfo,
	readFileFromDirectoryInfo
} from './util.js';

class OverlayFetcher {
	private _fetcher : Fetcher;
	private _pathPrefix : string;
	private _directory : DirectoryInfo;
	private _hasWrites : boolean = false;

	constructor(fetcher : Fetcher, pathPrefix : string, directory : DirectoryInfo) {
		this._fetcher = fetcher;
		this._pathPrefix = pathPrefix;
		this._directory = directory;
	}

	get localWriteablePath() : Path {
		return this._pathPrefix;
	}
	
	set localWriteablePath(path : Path) {
		throw new Error('OverlayFetcher doesn\'t support localWriteablePath');
	}

	get overlayHasWrites() : boolean {
		return this._hasWrites;
	}

	private internalPath(path : Path) : Path {
		const prefix = this._pathPrefix + '/';
		if (!path.startsWith(prefix)) throw new Error(`Path ${path} doesn't start with ${prefix}`);
		return path.slice(prefix.length);
	}

	pathIsLocalWriteable(path : Path) : boolean {
		return path.startsWith(this._pathPrefix);
	}

	fileFetch(path : Path) : Promise<string> {
		if (!this.pathIsLocalWriteable(path)) return this._fetcher.fileFetch(path);
		const result = readFileFromDirectoryInfo(this._directory, this.internalPath(path));
		return Promise.resolve(result);
	}

	fileExists(path : Path) : Promise<boolean> {
		if (!this.pathIsLocalWriteable(path)) return this._fetcher.fileExists(path);
		try {
			readFileFromDirectoryInfo(this._directory, this.internalPath(path));
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}

	listDirectory(path : Path, type: FileListingType = 'both') : Promise<Path[]> {
		if (!this.pathIsLocalWriteable(path)) return this._fetcher.listDirectory(path, type);
		const paths = listDirectoryFromDirectoryInfo(this._directory, this.internalPath(path), type);
		return Promise.resolve(paths);
	}
}

export const overlayFetcher = (fetcher : Fetcher, pathPrefix : string, directory : DirectoryInfo) : FetcherWithoutListSprouts => {
	return new OverlayFetcher(fetcher, pathPrefix, directory);
};