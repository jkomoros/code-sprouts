import {
	Fetcher,
	Path
} from './types.js';

import {
	readFileSync,
	existsSync,
	readdirSync,
	writeFileSync,
	statSync
} from 'fs';

import {
	Sprout
} from './sprout.js';

import {
	DEFAULT_SPROUT_DIRECTORIES
} from './constants.js';

import {
	joinPath
} from './util.js';

class NodeFetcher {

	set localWriteablePath(_path : Path) {
		throw new Error('NodeFetcher doesn\'t support localWriteablePath');
	}

	get localWriteablePath() : Path {
		throw new Error('NodeFetcher doesn\'t support localWriteablePath');
	}

	pathIsLocalWriteable(_path : Path) : boolean {
		return false;
	}

	async fileFetch(path : Path) : Promise<string> {
		//TODO: have a node and fetch-based version.
		const f = readFileSync(path);
		return f.toString();
	}

	async fileExists(path : Path) : Promise<boolean> {
		return existsSync(path);
	}

	async writeFile(path : Path, data : string) : Promise<void> {
		writeFileSync(path, data);
	}

	mayWriteFile(_path : Path) : boolean {
		return true;
	}

	supportsLastUpdated() : boolean {
		return true;
	}

	async fileLastUpdated(path : Path) : Promise<Date> {
		const stats = statSync(path);
		return stats.mtime;
	}

	async listDirectory(path : Path) : Promise<Path[]> {
		const result : Path[] = [];
		//Check if directory exists
		if (!existsSync(path)) {
			return [];
		}
		for (const entry of readdirSync(path)) {
			result.push(entry);
		}
		return result;
	}

	async listSprouts(basePaths : string[] = DEFAULT_SPROUT_DIRECTORIES) : Promise<Path[]> {
		//TODO: in a browser fetch context this will have to use a prebuilt listing file.
		const result : Path[] = [];
		for (const folder of basePaths) {
			for (const entry of readdirSync(folder, {withFileTypes: true})) {
				if (!entry.isDirectory()) continue;
				result.push(joinPath(folder, entry.name));
			}
		}
		return result;
	}
}

//Type to verify we match
const fetcher : Fetcher = new NodeFetcher();

Sprout.setFetcher(fetcher);

export default fetcher;