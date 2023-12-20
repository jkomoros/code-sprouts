import {
    Path
} from './types.js';

export class Sprout {
    _path : Path

    constructor(path : Path) {
        this._path = path;
    }

    //throws if invalid
    validate() : void {
        //TODO: implement
    }
}