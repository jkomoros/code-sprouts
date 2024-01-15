import {
	Fetcher,
	MetaFetcherType,
	FileListingType,
	Path
} from '../types.js';

import browser from './browser.js';

export class MetaFetcher {

	private _default : Fetcher;
	private _fetchers : Record<Path, Fetcher> = {};

	constructor(def : Fetcher) {
		this._default = def;
		this._fetchers = {};
	}

	fetcherForPath(path : Path) : Fetcher {
		for (const prefix of Object.keys(this._fetchers)) {
			if (path.startsWith(prefix)) {
				return this._fetchers[prefix];
			}
		}
		return this._default;
	}

	setSubFetcher(pathPrefix : Path, fetcher : Fetcher) {
		this._fetchers[pathPrefix] = fetcher;
	}

	setDefaultFetcher(fetcher : Fetcher) {
		this._default = fetcher;
	}

	fileFetch(path : Path) : Promise<string> {
		return this.fetcherForPath(path).fileFetch(path);
	}

	fileExists(path : Path) : Promise<boolean> {
		return this.fetcherForPath(path).fileExists(path);
	}

	listDirectory(path : Path, type : FileListingType) : Promise<Path[]> {
		return this.fetcherForPath(path).listDirectory(path, type);
	}

	writeable(path : Path) : boolean {
		return this.fetcherForPath(path).writeable(path);
	}
	
	async listSprouts() : Promise<Path[]> {
		
		const defaultSprouts = await this._default.listSprouts();
		const result : Path[] = [...defaultSprouts];
		for (const fetcher of Object.values(this._fetchers)) {
			const sprouts = await fetcher.listSprouts();
			result.push(...sprouts);
		}
		return result;
	}


}

const metaFetcher : MetaFetcherType = new MetaFetcher(browser);

export default metaFetcher;