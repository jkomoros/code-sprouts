import {
    Path
} from './types.js';

import {
    readFileSync,
    existsSync,
    readdirSync
} from 'fs';

import {
    join
} from 'path';

const SPROUT_EXAMPLE_DIR = 'examples';

export const fileFetch = async (path : Path) : Promise<string> => {
    //TODO: have a node and fetch-based version.
    const f = readFileSync(path);
    return f.toString();
};

export const fileExists = async (path : Path) : Promise<boolean> => {
    return existsSync(path);
};

export const joinPath = (...parts : string[]) : Path => {
    return join(...parts);
};

export const listSprouts = async (basePaths : string[] = [SPROUT_EXAMPLE_DIR]) : Promise<Path[]> => {
    //TODO: in a browser fetch context this will have to use a prebuilt listing file.
    const result : Path[] = [];
    for (const folder of basePaths) {
        for (const entry of readdirSync(folder, {withFileTypes: true})) {
            if (!entry.isDirectory()) continue;
            result.push(entry.name);
        }
    }
    return result;
};