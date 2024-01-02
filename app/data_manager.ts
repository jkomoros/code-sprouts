import {
	ModelProvider,
	PackagedSprout,
	SproutName
} from '../src/types.js';

import {
	writeDirectoryInfo
} from '../src/util.js';

import {
	fetcher
} from './fetcher.js';

import {
	store
} from './store.js';

import {
	writeSprout
} from './actions/data.js';

/*
	TODO: make a src/util.ts function that takes a NakedUncompiledPackagedSprout and returns a PackagedSprout.
	TODO: make a createSprout action creator that just creates a naked sprout with the given name
	TODO: DataManager gets a mayCreateSprout() : boolean
	TODO: add a createSprout button to sprout-viewer if mayCreateSprout() is true
	TODO: sprout-editor gets editable=true if mayWriteSprout(this._currentSproutName) is true.
	TODO: add a deleteSprout ability.
*/

export class DataManager {
	
	private localStorageKeyForAPIKey(provider : ModelProvider) : string {
		return `api_key:${provider}`;
	}

	async storeAPIKey(provider : ModelProvider, apiKey : string) : Promise<void> {
		window.localStorage.setItem(this.localStorageKeyForAPIKey(provider), apiKey);
	}

	async retrieveAPIKey(provider : ModelProvider) : Promise<string> {
		const str = window.localStorage.getItem(this.localStorageKeyForAPIKey(provider));
		return str ? str : '';
	}

	async mayWriteSprout(sproutName : SproutName) : Promise<boolean> {
		return fetcher.pathIsLocalWriteable(sproutName);
	}

	async writeSprout(sproutName : SproutName, pkg : PackagedSprout) : Promise<void> {
		if (!fetcher.mayWriteFile(sproutName)) throw new Error('Cannot write sprout');
		//We can write every part because fetcher.writeFile will not update the file if the data is the same.
		await writeDirectoryInfo(fetcher, pkg, sproutName);
		store.dispatch(writeSprout(sproutName, pkg));
	}
}

export default new DataManager();