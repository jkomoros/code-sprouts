import {
	FileInfo,
	FileListingType,
	Path,
	fileInfoSchema
} from './types.js';

import {
	assertUnreachable
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

	static lastUpdated(filename : Path) : Date {
		const info = this.fileInfo(filename);
		if (!info) throw new Error(`File not found: ${filename}`);
		return new Date(info.lastModified);
	}

	private static fileInfo(filename : Path) : FileInfo | null {
		const str = window.localStorage.getItem(this.localStorageKeyForFile(filename));
		if (str === null) {
			return null;
		}
		const data = JSON.parse(str);
		const fileInfoParseResult = fileInfoSchema.safeParse(data);
		if (!fileInfoParseResult.success) {
			throw new Error(`Invalid file info: ${fileInfoParseResult.error}`);
		}
		return fileInfoParseResult.data;
	}

	static readFile(filename : Path) : string {
		const info = this.fileInfo(filename);
		if (!info) throw new Error(`File not found: ${filename}`);
		return info.content;
	}

	static writeFile(filename : Path, data : string) : void {

		if (this.fileExists(filename)) {
			const info = this.fileInfo(filename);
			if (!info) throw new Error(`File not found despite existing: ${filename}`);
			if (info.content === data) {
				//No change, don't update the string
				return;
			}
		}

		const info : FileInfo = {
			content: data,
			lastModified: new Date().toISOString()
		};

		window.localStorage.setItem(this.localStorageKeyForFile(filename), JSON.stringify(info, null, '\t'));
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