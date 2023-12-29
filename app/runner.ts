import {
	Sprout
} from '../src/sprout.js';

import {
	Prompt,
	SproutState
} from '../src/types.js';

type VoidFunction = () => void;
type MessageFunction = (message : string) => void;

type SignallerOptions = {
	streamStarted: VoidFunction,
	streamStopped: (state : SproutState) => void,
	streamIncrementalMessage: MessageFunction
}

//TODO: rename this to StreamSignaller
//TODO: should this be the way that the runSproutInCLI interacts with it too?
export class Signaller {
	private _done = false;
	private _opts :SignallerOptions;
	private _userMessageCallback : ((response : Prompt) => void) | null = null;
	private _userMessage : Prompt | null = null;

	constructor(opts : SignallerOptions) {
		this._opts = opts;
	}

	streamStarted() : void {
		this._opts.streamStarted();
	}

	streamStopped(state : SproutState) : void {
		this._opts.streamStopped(state);
	}

	streamIncrementalMessage(message : string) : void {
		this._opts.streamIncrementalMessage(message);
	}

	provideUserResponse(response : Prompt) : void {
		if (this._userMessageCallback) {
			this._userMessageCallback(response);
			this._userMessageCallback = null;
			this._userMessage = null;
			return;
		}
		this._userMessage = response;
	}

	async getUserMessage() : Promise<Prompt> {
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
		signaller.streamStopped(await sprout.lastState());
		const response = await signaller.getUserMessage();
		if (!response) {
			signaller.finish();
			break;
		}
		sprout.provideUserResponse(response || '');
	}
};