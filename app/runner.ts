import {
	Sprout
} from '../src/sprout.js';

//TODO: rename this to StreamSignaller
export class Signaller {
	private _done = false;
	private _streamStarted : () => void;
	private _streamStopped : () => void;

	constructor(opts : {streamStarted: () => void, streamStopped: () => void}) {
		const {streamStarted, streamStopped} = opts;
		this._streamStarted = streamStarted;
		this._streamStopped = streamStopped;
	}

	streamStarted() : void {
		this._streamStarted();
	}

	streamStopped() : void {
		this._streamStopped();
	}

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
		signaller.streamStarted();
		const message = await sprout.conversationTurn({
			//For some reason if you don't pass a stream logger it doesn't work.
			streamLogger: () => {}
		});
		signaller.streamStopped();
		console.log('result', message);
		//TODO: better UI to allow user to provide a response.
		const response = prompt(`The AI said:\n${message}\n\nWhat is your response?`);
		if (!response) {
			signaller.finish();
			break;
		}
		sprout.provideUserResponse(response || '');
	}
};