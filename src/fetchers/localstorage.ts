import {
	LocalStorageFilesystem
} from '../local_storage_filesystem.js';

import {
	Fetcher,
	FileListingType,
	PackagedSprout,
	Path,
	SproutName
} from '../types.js';

export class LocalStorageFetcher {

	writeable(_path : Path): boolean {
		return true;
	}

	async writeSprout(name : SproutName, pkg : PackagedSprout): Promise<void> {
		LocalStorageFilesystem.writeDirectoryInfo(pkg, name);
	}

	async deleteSprout(name : SproutName): Promise<void> {
		LocalStorageFilesystem.deleteDirectory(name);
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