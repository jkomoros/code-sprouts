import {
	Sprout
} from '../src/sprout.js';

export const fetcher = Sprout.getFetcher();
if (!fetcher) throw new Error('No fetcher available');
const LOCAL_SPROUTS_PATH = 'private';
fetcher.localWriteablePath = LOCAL_SPROUTS_PATH;