import {
	DirectoryInfo,
	Fetcher,
	Path,
	FileListingType
} from '../types.js';

import {
	listDirectoryFromDirectoryInfo,
	readFileFromDirectoryInfo
} from '../util.js';

export class DirectoryInfoFetcher {
	private _pathPrefix : string;
	private _directory : DirectoryInfo;
	private _hasWrites : boolean = false;

	constructor(pathPrefix : string, directory : DirectoryInfo) {
		this._pathPrefix = pathPrefix;
		this._directory = directory;
	}

	writeable(_path : Path) : boolean {
		return true;
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
		if (!this.pathIsLocalWriteable(path)) throw new Error(`Path ${path} isn't local writeable`);
		const result = readFileFromDirectoryInfo(this._directory, this.internalPath(path));
		return Promise.resolve(result);
	}

	fileExists(path : Path) : Promise<boolean> {
		if (!this.pathIsLocalWriteable(path)) throw new Error(`Path ${path} isn't local writeable`);
		try {
			readFileFromDirectoryInfo(this._directory, this.internalPath(path));
			return Promise.resolve(true);
		} catch (e) {
			return Promise.resolve(false);
		}
	}

	listDirectory(path : Path, type: FileListingType = 'both') : Promise<Path[]> {
		if (!this.pathIsLocalWriteable(path)) throw new Error(`Path ${path} isn't local writeable`);
		const paths = listDirectoryFromDirectoryInfo(this._directory, this.internalPath(path), type);
		return Promise.resolve(paths);
	}

	async listSprouts() : Promise<Path[]> {
		return [];
	}
}

//Smoketest
const _ : Fetcher = new DirectoryInfoFetcher('', {});

