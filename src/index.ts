import {
    listSprouts
} from './fetcher.js';

const main = async () : Promise<void> => {
    const sproutPaths = await listSprouts();
    for (const path of sproutPaths) {
        console.log(path);
    }
    //TODO: actually run one
}

(async() => {
	await main();
})();