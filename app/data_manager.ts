import {
	SPROUT_CONFIG_PATH
} from '../src/constants.js';

import {
	ModelProvider,
	PackagedSprout,
	SproutName
} from '../src/types.js';

import {
	joinPath
} from '../src/util.js';

import {
	WRITE_SPROUT
} from './actions.js';

import {
	removeSprouts
} from './actions/data.js';

import {
	fetcher
} from './fetcher.js';

import {
	store
} from './store.js';


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
		return fetcher.writeable(sproutName);
	}

	async writeSprout(sproutName : SproutName, pkg : PackagedSprout) : Promise<void> {
		if (!fetcher.writeable(sproutName)) throw new Error('Cannot write sprout');
		await fetcher.writeSprout(sproutName, pkg);
		store.dispatch({
			type: WRITE_SPROUT,
			name: sproutName,
			sprout: pkg
		});
	}

	//This deletes the sprout, removing it from the current list, but also
	//removing it from the filesystem if it's a writeable sprout.
	async deleteSprout(sproutName : SproutName) : Promise<void> {
		//Remove the sprout first, THEN actually delete the diretory. This
		//avoids a "currentSprout is not defined" kind of problem.
		store.dispatch(removeSprouts({[sproutName]: true}));
		if (fetcher.writeable(sproutName)) {
			//Also remove from filesystem.
			await fetcher.deleteSprout(sproutName);
		}
	}
}

export default new DataManager();