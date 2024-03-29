import {
	DirectoryInfo,
	Fetcher,
	FileListingType,
	PackagedSprout,
	Path,
	SproutName
} from '../types.js';

import {
	readFileSync,
	existsSync,
	readdirSync,
	mkdirSync,
	writeFileSync,
	rmdirSync
} from 'fs';

import {
	dirname
} from 'path';

import {
	Sprout
} from '../sprout.js';

import {
	DEFAULT_SPROUT_DIRECTORIES
} from '../constants.js';

import {
	assertUnreachable,
	joinPath
} from '../util.js';

class NodeFetcher {

	writeable(_path : Path) : boolean {
		return true;
	}

	private writeFile(path : Path, data : string) : void {
		const dir = dirname(path);
		mkdirSync(dir, {recursive: true});
		writeFileSync(path, data);
	}

	private writeDirectory(path : Path, info : DirectoryInfo) : void {
		for (const [subPath, data] of Object.entries(info)) {
			if (typeof data === 'string') {
				this.writeFile(joinPath(path, subPath), data);
			} else {
				this.writeDirectory(joinPath(path, subPath), data);
			}
		}
	}

	async writeSprout(name : SproutName, pkg : PackagedSprout) : Promise<void> {
		this.writeDirectory(name, pkg);
	}

	async deleteSprout(name : SproutName) : Promise<void> {
		rmdirSync(name, {recursive: true});
	}

	async fileFetch(path : Path) : Promise<string> {
		//TODO: have a node and fetch-based version.
		const f = readFileSync(path);
		return f.toString();
	}

	async fileExists(path : Path) : Promise<boolean> {
		return existsSync(path);
	}

	async listDirectory(path : Path, type : FileListingType) : Promise<Path[]> {
		const result : Path[] = [];
		//Check if directory exists
		if (!existsSync(path)) {
			return [];
		}
		for (const entry of readdirSync(path, {withFileTypes: true})) {
			switch(type) {
			case 'both':
				result.push(entry.name);
				break;
			case 'directory':
				if (entry.isDirectory()) result.push(entry.name);
				break;
			case 'file':
				if(entry.isFile()) result.push(entry.name);
				break;
			default:
				assertUnreachable(type);
			}
		}
		return result;
	}

	async listSprouts() : Promise<Path[]> {
		const basePaths = DEFAULT_SPROUT_DIRECTORIES;
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

const meta = Sprout.getFetcher();
meta.setDefaultFetcher(fetcher);

export default fetcher;