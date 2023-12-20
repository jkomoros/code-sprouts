import {
    Path
} from './types.js';

import {
    readFileSync
} from 'fs';

import {
    join
} from 'path';

export const fetchFile = async (path : Path) : Promise<string> => {
    //TODO: have a node and fetch-based version.
    const f = readFileSync(path);
    return f.toString();
};

export const joinPath = (...parts : string[]) : Path => {
    return join(...parts);
};