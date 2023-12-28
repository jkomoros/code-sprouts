import {
	Sprout
} from '../src/sprout.js';

type VoidFunction = () => void;
type MessageFunction = (message : string) => void;

type SignallerOptions = {
	streamStarted: VoidFunction,
	streamStopped: VoidFunction,
	streamIncrementalMessage: MessageFunction
	getUserMessage: (previousSproutMessage : string) => Promise<string>;
}

//TODO: rename this to StreamSignaller
//TODO: should this be the way that the runSproutInCLI interacts with it too?
export class Signaller {
	private _done = false;
	private _opts :SignallerOptions;

	constructor(opts : SignallerOptions) {
		this._opts = opts;
	}

	streamStarted() : void {
		this._opts.streamStarted();
	}

	streamStopped() : void {
		this._opts.streamStopped();
	}

	streamIncrementalMessage(message : string) : void {
		this._opts.streamIncrementalMessage(message);
	}

	getUserMessage(previousSproutMessage : string) : Promise<string> {
		return this._opts.getUserMessage(previousSproutMessage);
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
			//Use a => to bind to this
			streamLogger: (message : string) => signaller.streamIncrementalMessage(message)
		});
		signaller.streamStopped();
		const response = await signaller.getUserMessage(message);
		if (!response) {
			signaller.finish();
			break;
		}
		sprout.provideUserResponse(response || '');
	}
};