import {
	Fetcher,
	Path
} from './types.js';

import {
	readFileSync,
	existsSync,
	readdirSync,
	writeFileSync
} from 'fs';

import {
	join
} from 'path';

const SPROUT_EXAMPLE_DIR = 'examples';

class NodeFetcher {
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

	joinPath(...parts : string[]) : Path {
		return join(...parts);
	}

	async listSprouts(basePaths : string[] = [SPROUT_EXAMPLE_DIR]) : Promise<Path[]> {
		//TODO: in a browser fetch context this will have to use a prebuilt listing file.
		const result : Path[] = [];
		for (const folder of basePaths) {
			for (const entry of readdirSync(folder, {withFileTypes: true})) {
				if (!entry.isDirectory()) continue;
				result.push(this.joinPath(folder, entry.name));
			}
		}
		return result;
	}
}

//Type to verify we match
const fetcher : Fetcher = new NodeFetcher();

export default fetcher;