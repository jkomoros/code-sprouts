import {
	LocalStorageFetcher
} from '../src/fetcher-localstorage.js';

import {
	Sprout
} from '../src/sprout.js';

import {
	LOCAL_SPROUTS_PATH
} from './constants.js';

export const fetcher = Sprout.getFetcher();
if (!fetcher) throw new Error('No fetcher available');
fetcher.setSubFetcher(LOCAL_SPROUTS_PATH, new LocalStorageFetcher());