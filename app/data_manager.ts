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

/*
	TODO: Do the same _inProgessCompilation process for all calcualted properties of Sprout that might do a network request.
	TODO: fetch-browser should keep track of in-progress fetches and vend the same promise.
	TODO: When opening sprout for editing, snapshot a copy of the compiled Sprout and change it
	TODO: a EDITING_COMMIT action that commits the changes to the sprout.
	TODO: an EDITING_CANCEL action that discards the changes to the sprout.
	TODO: when loading, all local private sprouts should show in the drop down.
	TODO: a button that doesn't look like the existing plus icon for 'create a sprout'
	TODO: allow adding a missing config property
	TODO: allow removing a config property that's not required
	TODO: allow adding a missing sub-instruction
	TODO: sprout-editor gets editable=true if mayWriteSprout(this._currentSproutName) is true.
	TODO: add a deleteSprout ability.
	TODO: compilation of sprout should keep track of what values require whic hother values and which ones require AI, and then automate construction of e.g. NakedUncompiledPackagedSproutNotNeedingAI
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
		store.dispatch({
			type: 'WRITE_SPROUT',
			name: sproutName,
			sprout: pkg
		});
	}
}

export default new DataManager();