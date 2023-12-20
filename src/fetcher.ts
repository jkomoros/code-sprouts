import {
    Path
} from './types.js';

import {
    readFileSync,
    existsSync
} from 'fs';

import {
    join
} from 'path';

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