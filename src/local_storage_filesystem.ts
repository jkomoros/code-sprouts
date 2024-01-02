import {
	FileInfo,
	Path,
	fileInfoSchema
} from './types.js';

const LOCAL_STORAGE_FILESYSTEM_PREFIX = 'file:';

export class LocalStorageFilesystem {

	private localStorageKeyForFile(filename : Path) : string {
		return `${LOCAL_STORAGE_FILESYSTEM_PREFIX}${filename}`;
	}

	fileExists(filename : Path) : boolean {
		const str = window.localStorage.getItem(this.localStorageKeyForFile(filename));
		return str !== null;
	}

	lastUpdated(filename : Path) : Date {
		const info = this.fileInfo(filename);
		if (!info) throw new Error(`File not found: ${filename}`);
		return new Date(info.lastModified);
	}

	private fileInfo(filename : Path) : FileInfo | null {
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

	readFile(filename : Path) : string {
		const info = this.fileInfo(filename);
		if (!info) throw new Error(`File not found: ${filename}`);
		return info.content;
	}

	writeFile(filename : Path, data : string) : void {

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

	listDirectory(path : Path) : Path[] {
		if (!path.endsWith('/')) path += '/';
		const result : Path[] = [];
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i);
			if (!key) continue;
			if (!key.startsWith(`${LOCAL_STORAGE_FILESYSTEM_PREFIX}${path}/`)) continue;
			const filename = key.substr(LOCAL_STORAGE_FILESYSTEM_PREFIX.length);
			const rest = filename.substr(path.length);
			const parts = rest.split('/');
			if (parts.length == 0) throw new Error(`Invalid filename: ${filename}`);
			result.push(parts[0]);
		}
		return result;
	}

}