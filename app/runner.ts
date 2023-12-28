import {
	Sprout
} from '../src/sprout.js';

//TODO: rename this to StreamSignaller
export class Signaller {
	private _done = false;
	private _streamStarted : () => void;
	private _streamStopped : () => void;
	private _streamIncrementalMessage: (message : string) => void;

	constructor(opts : {streamStarted: () => void, streamStopped: () => void, streamIncrementalMessage : (message : string) => void}) {
		const {streamStarted, streamStopped, streamIncrementalMessage} = opts;
		this._streamStarted = streamStarted;
		this._streamStopped = streamStopped;
		this._streamIncrementalMessage = streamIncrementalMessage;
	}

	streamStarted() : void {
		this._streamStarted();
	}

	streamStopped() : void {
		this._streamStopped();
	}

	streamIncrementalMessage(message : string) : void {
		this._streamIncrementalMessage(message);
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
		signaller.streamStarted();
		const message = await sprout.conversationTurn({
			streamLogger: signaller.streamIncrementalMessage
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