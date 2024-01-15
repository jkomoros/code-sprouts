import {
	LocalStorageFilesystem
} from './local_storage_filesystem.js';

import {
	Fetcher,
	FileListingType,
	Path
} from './types.js';


export class LocalStorageFetcher {

	writeable(_path : Path): boolean {
		return true;
	}

	async fileFetch(path: string): Promise<string> {
		return LocalStorageFilesystem.readFile(path);
	}

	async fileExists(path: string): Promise<boolean> {
		return LocalStorageFilesystem.fileExists(path);
	}

	async listDirectory(path: string, type : FileListingType): Promise<string[]> {
		return LocalStorageFilesystem.listDirectory(path, type);
	}	

	listSprouts(): Promise<Path[]> {
		throw new Error('FilesystemFetcher doesn\'t support listSprouts');
	}
}

const localStorageFetcher : Fetcher = new LocalStorageFetcher();

export default localStorageFetcher;