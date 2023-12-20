import {
    fileExists,
    fileFetch,
    joinPath
} from './fetcher.js';

import {
    Path,
    SproutName,
    sproutConfigSchema
} from './types.js';

//Relative to the sprout root
const SPROUT_CONFIG_PATH = 'config.json';

export class Sprout {
    _path : Path

    constructor(path : Path) {
        this._path = path;
    }

    get name() : SproutName {
        //TODO: return the last path component
        return this._path;
    }

    //throws if invalid
    async validate() : Promise<void> {
        const sproutConfigPath = joinPath(this._path, SPROUT_CONFIG_PATH);
        if (!await fileExists(sproutConfigPath)) {
            throw new Error(`${this.name}: Config file ${sproutConfigPath} not found`);
        }
        const configData = await fileFetch(sproutConfigPath);
        //Tnis will throw if invalid shape.
        const config = sproutConfigSchema.parse(JSON.parse(configData));
        if (!config) throw new Error(`${this.name}: No config`);
        //TODO: validate shape
    }
}