import {
	Sprout
} from '../src/sprout.js';

type VoidFunction = () => void;
type MessageFunction = (message : string) => void;

type SignallerOptions = {
	streamStarted: VoidFunction,
	streamStopped: VoidFunction,
	streamIncrementalMessage: MessageFunction
}

//TODO: rename this to StreamSignaller
//TODO: should this be the way that the runSproutInCLI interacts with it too?
export class Signaller {
	private _done = false;
	private _opts :SignallerOptions;
	private _userMessageCallback : ((response : string) => void) | null = null;
	private _userMessage : string | null = null;

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

	provideUserResponse(response : string) : void {
		if (this._userMessageCallback) {
			this._userMessageCallback(response);
			this._userMessageCallback = null;
			this._userMessage = null;
			return;
		}
		this._userMessage = response;
	}

	async getUserMessage() : Promise<string> {
		if (this._userMessage) {
			const message = this._userMessage;
			this._userMessage = null;
			this._userMessageCallback = null;
			return message;
		}
		return new Promise((resolve) => {
			this._userMessageCallback = resolve;
		});
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
		await sprout.conversationTurn({
			//Use a => to bind to this
			streamLogger: (message : string) => signaller.streamIncrementalMessage(message)
		});
		signaller.streamStopped();
		const response = await signaller.getUserMessage();
		if (!response) {
			signaller.finish();
			break;
		}
		sprout.provideUserResponse(response || '');
	}
};