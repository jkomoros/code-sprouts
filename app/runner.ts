import {
	Sprout
} from '../src/sprout.js';

export class Signaller {
	private _done = false;

	finish() : void {
		this._done = true;
	}

	get done() : boolean {
		return this._done;
	}
}

export const runSproutInBrowser = async (sprout : Sprout, signaller : Signaller) => {
	await sprout.validate();

	//TODO: support images
	while(!signaller.done) {
		//TODO: stream to output
		const message = await sprout.conversationTurn({
			//For some reason if you don't pass a stream logger it doesn't work.
			streamLogger: () => {}
		});
		console.log('result', message);
		//TODO: better UI to allow user to provide a response.
		const response = prompt(`The AI said:\n${message}\n\nWhat is your response?`);
		sprout.provideUserResponse(response || '');
	}
};