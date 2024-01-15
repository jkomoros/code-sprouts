import {
	LocalStorageFilesystem
} from './local_storage_filesystem.js';

import {
	Fetcher,
	FileListingType,
	Path
} from './types.js';


class FilesystemFetcher {

	set localWriteablePath(path: string) {
		throw new Error('FilesystemFetcher doesn\'t support localWriteablePath');
	}

	get localWriteablePath(): string {
		throw new Error('FilesystemFetcher doesn\'t support localWriteablePath');
	}

	pathIsLocalWriteable(_path: string): boolean {
		return false;
	}

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

const filesystemFetcher : Fetcher = new FilesystemFetcher();

export default filesystemFetcher;