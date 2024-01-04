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

TODO: clean up the Sprout file fetching and compiling machinery.

We don't need to actually care about lastUpdated because all of the files are so
small that the main overhead is requesting all of them at once.

The raw files are fetched into a structure called a PackagedUncompiledSprout.

This is in the shape of a DirectoryInfo, but with explicitly enumerated
filenames (outside of sub_instructions). FileInfo goes away and just becomes a
string, the stringified file contents.

PackedSprout is a sprout that has all of it files, including a CompiledSprout
file, as well as all of the inputs.

A sprout also has a fetchUncompiledPackage() method that returns a
PackagedUncompiledSprout by fetching each file (caching the answer). It also has
a fetchCompiledSprout() that fetches and returns the CompiledSprout, caching it

The compilation process takes a packagedUncompiledSprout and a previous
compiledSprout and returns a new compiledSprout.

For each field in the output, it does the transformation (typically a filename
change for a sub-folder keys, or instructions).

Some fields require expensive compilation, like calling an AI. These will check
if the input text is identical as the provided compiledSprout and if so, will
just copy over the previous results.

A sprout has a method package(compiled : boolean) PackagedUncompiledSprout |
PackagedSprout. First, it calls fetchUncompiledPackage if it does not have a
cached answer. If it's uncompiled, it returns that. If it's compiled it also
fetches the compiledSprout, passes both to the compilation process, and then
returns that result. and returns that.

- Remove all lastUpdated stuff from Sprout and Fetcher, and get rid of the idea
  of a non-naked DirectoryInfo, because we never check for lastUpdated.

*/


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