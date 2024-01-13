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
	REMOVE_SPROUTS,
	WRITE_SPROUT
} from './actions.js';

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
		return fetcher.pathIsLocalWriteable(sproutName);
	}

	async writeSprout(sproutName : SproutName, pkg : PackagedSprout) : Promise<void> {
		if (!fetcher.mayWriteFile(sproutName)) throw new Error('Cannot write sprout');
		//We can write every part because fetcher.writeFile will not update the file if the data is the same.
		await writeDirectoryInfo(fetcher, pkg, sproutName);
		store.dispatch({
			type: WRITE_SPROUT,
			name: sproutName,
			sprout: pkg
		});
	}

	//This deletes the sprout, removing it from the current list, but also
	//removing it from the filesystem if it's a writeable sprout.
	async deleteSprout(sproutName : SproutName) : Promise<void> {
		if (fetcher.mayWriteFile(sproutName)) {
			//Also remove from filesystem.
			fetcher.deleteDirectory(sproutName);
		}
		store.dispatch({
			type: REMOVE_SPROUTS,
			sprouts: {
				[sproutName]: true
			}
		});
	}
}

export default new DataManager();