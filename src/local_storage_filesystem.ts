import {
	FileListingType,
	Path
} from './types.js';

import {
	assertUnreachable, joinPath
} from './util.js';

const LOCAL_STORAGE_FILESYSTEM_PREFIX = 'file:';

export class LocalStorageFilesystem {

	private static localStorageKeyForFile(filename : Path) : string {
		return `${LOCAL_STORAGE_FILESYSTEM_PREFIX}${filename}`;
	}

	static fileExists(filename : Path) : boolean {
		const str = window.localStorage.getItem(this.localStorageKeyForFile(filename));
		return str !== null;
	}

	static readFile(filename : Path) : string {
		const data = window.localStorage.getItem(this.localStorageKeyForFile(filename));
		if (data === null) throw new Error(`No such file: ${filename}`);
		return data;
	}

	static writeFile(filename : Path, data : string) : void {
		window.localStorage.setItem(this.localStorageKeyForFile(filename), data);
	}

	static deleteFile(filename : Path) : void {
		window.localStorage.removeItem(this.localStorageKeyForFile(filename));
	}

	static deleteDirectory(filename : Path) : void {
		for (const file of this.listDirectory(filename, 'file')) {
			this.deleteFile(joinPath(filename, file));
		}
		for (const dir of this.listDirectory(filename, 'directory')) {
			this.deleteDirectory(joinPath(filename, dir));
		}
		const paths = this.listDirectory(filename, 'both');
		if (paths.length > 0) throw new Error(`Directory not empty: ${filename}`);
	}

	static listDirectory(path : Path, type: FileListingType) : Path[] {
		if (path && !path.endsWith('/')) path += '/';
		const result : Path[] = [];
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i);
			if (!key) continue;
			if (!key.startsWith(`${LOCAL_STORAGE_FILESYSTEM_PREFIX}${path}`)) continue;
			const filename = key.substr(LOCAL_STORAGE_FILESYSTEM_PREFIX.length);
			const rest = filename.substr(path.length);
			const parts = rest.split('/');
			if (parts.length == 0) throw new Error(`Invalid filename: ${filename}`);
			switch(type) {
			case 'both':
				result.push(parts[0]);
				break;
			case 'directory':
				if (parts.length > 1) result.push(parts[0]);
				break;
			case 'file':
				if (parts.length === 1) result.push(parts[0]);
				break;
			default:
				assertUnreachable(type);
			}
		}
		return result;
	}

}