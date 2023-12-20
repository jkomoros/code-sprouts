import {
    fileExists,
    fileFetch,
    joinPath
} from './fetcher.js';

import {
    Path,
    SproutConfig,
    SproutName,
    sproutConfigSchema
} from './types.js';

//Relative to the sprout root
const SPROUT_CONFIG_PATH = 'config.json';

export class Sprout {
    _path : Path
    _config?: SproutConfig

    constructor(path : Path) {
        this._path = path;
    }

    get name() : SproutName {
        //TODO: return the last path component
        return this._path;
    }

    async config() : Promise<SproutConfig> {
        if (!this._config) {
            const sproutConfigPath = joinPath(this._path, SPROUT_CONFIG_PATH);
            if (!await fileExists(sproutConfigPath)) {
                throw new Error(`${this.name}: Config file ${sproutConfigPath} not found`);
            }
            const configData = await fileFetch(sproutConfigPath);
            //Tnis will throw if invalid shape.
            const config = sproutConfigSchema.parse(JSON.parse(configData));
            if (!config) throw new Error(`${this.name}: No config`);
        }
        if (!this._config) throw new Error(`${this.name}: Couldn't create sprout`);
        return this._config;
    }

    //throws if invalid
    async validate() : Promise<void> {
        //Will throw if invalid
        await this.config();
    }
}