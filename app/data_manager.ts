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

	async mayWriteSprout(sproutName : SproutName) : Promise<boolean> {
		return fetcher.pathIsLocalWriteable(sproutName);
	}

	async writeSprout(sproutName : SproutName, pkg : PackagedSprout) : Promise<void> {
		if (!fetcher.mayWriteFile(sproutName)) throw new Error('Cannot write sprout');
		//We can write every part because fetcher.writeFile will not update the file if the data is the same.
		await writeDirectoryInfo(fetcher, pkg, sproutName);
	}
}

export default new DataManager();