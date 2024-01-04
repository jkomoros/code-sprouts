import {
	SPROUT_CONFIG_PATH
} from '../src/constants.js';

import {
	ModelProvider,
	PackagedSprout,
	SproutName
} from '../src/types.js';

import {
	joinPath,
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
	TODO: create a sprout .package(compiled : boolean) method that returns a NakedPackagedSprout or NakedUncompiledPackagedSprout:
		package<T extends boolean>(compiled: T): T extends true ? NakedPackagedSprout : NakedUncompiledPackagedSprout; 
	TODO: When opening sprout for editing, snapshot a copy of the compiled Sprout and change it
	TODO: a EDITING_COMMIT action that commits the changes to the sprout.
	TODO: an EDITING_CANCEL action that discards the changes to the sprout.
	TODO: allow adding a missing config property
	TODO: allow removing a config property that's not required
	TODO: allow adding a missing sub-instruction
	TODO: sprout-editor gets editable=true if mayWriteSprout(this._currentSproutName) is true.
	TODO: add a deleteSprout ability.
	TODO: compilation of sprout should keep track of what values require whic hother values and which ones require AI, and then automate construction of e.g. NakedUncompiledPackagedSproutNotNeedingAI

	TODO: Add a Sprout.recompileIfNecessary() that is only called if lastUpdated is above some epsilon; if not, it trusts the compiled sprout is fine.
	TODO: Ensure that only one compilation process is running at a time.
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

	async sproutExists(sproutName : SproutName) : Promise<boolean> {
		return fetcher.fileExists(joinPath(sproutName, SPROUT_CONFIG_PATH));
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