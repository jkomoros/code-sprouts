import {
    fileExists,
    joinPath
} from './fetcher.js';

import {
    Path
} from './types.js';

//Relative to the sprout root
const SPROUT_CONFIG_PATH = 'config.json';

export class Sprout {
    _path : Path

    constructor(path : Path) {
        this._path = path;
    }

    //throws if invalid
    validate() : void {
        const sproutConfigPath = joinPath(this._path, SPROUT_CONFIG_PATH);
        if (!fileExists(sproutConfigPath)) {
            throw new Error(`Config file ${sproutConfigPath} not found`);
        }
        //TODO: validate shape
    }
}