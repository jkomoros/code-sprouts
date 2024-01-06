import { Sprout } from './sprout.js';
import {
	Prompt,
	SproutState
} from './types.js';

type SignallerSproutInfo = {
	//If getUserMessage is called before a user message is available, we return
	//this channel that will resolve when we recieve it.
	userMessageCallback? : (response : Prompt) => void,
	//When provideUserResponse happens before the caller tries to fetch it, we store it here.
	userMessage? : Prompt,

	//This is the signal that callers can use Promise.race() to see if they need to stop streaming early for any reason.
	stopStreamSignal? : Promise<void>,
	//This is the callback to complete cancelStreamInput.
	resolveStopStreamSignal? : () => void,
	streamingStopped : boolean;

	//This is a signal that callers who need to be ready to end early can use Promise.race() on.
	doneSignal : Promise<void>,
	//This is the callback that makes doneSignal return.
	resolveDone : () => void,
	done : boolean
}

//In a method to close over the thing we create.
const createSproutInfo = () : SignallerSproutInfo => {
	const info : Partial<SignallerSproutInfo> = {
		done: false,
		streamingStopped: false
	};
	const doneSignal = new Promise<void>(resolve => {
		info.resolveDone = resolve;
	});
	info.doneSignal = doneSignal;
	return info as SignallerSproutInfo;
};

export abstract class ConversationSignaller {
	private _sproutInfo : WeakMap<Sprout, SignallerSproutInfo>;

	constructor() {
		this._sproutInfo = new WeakMap();
	}

	streamWillStart (sprout : Sprout) : void {
		const info = this.getSproutInfo(sprout);
		info.streamingStopped = false;
		const stopStreamSignal = new Promise<void>(resolve => {
			info.resolveStopStreamSignal = resolve;
		});
		info.stopStreamSignal = stopStreamSignal;
		//It's possible that the whole sprout was finished before the first
		//stream started. If so, return immediately. We still make the signal so
		//it will immediately realize it's done.
		if (info.done) this.stopStreaming(sprout);
	}

	//Async methods
	abstract streamStarted(sprout : Sprout) : Promise<void>;
	abstract streamStopped(sprout : Sprout, state : SproutState): Promise<void>;
	//This isn't async
	//What streamLogger passes from conversationTurn
	abstract streamIncrementalMessage(sprout : Sprout, message : string): void;
	//What debugStreamLogger passes from converastionTurn.
	streamIncrementalDebugMessage(_sprout : Sprout, _debugMessage : string) : void {
		//By default does nothing
	}

	private getSproutInfo(sprout : Sprout) : SignallerSproutInfo {
		let info = this._sproutInfo.get(sprout);
		if (!info) {
			info = createSproutInfo();
			this._sproutInfo.set(sprout, info);
		}
		return info;
	}

	provideUserResponse(sprout : Sprout, response : Prompt) : void {
		const info = this.getSproutInfo(sprout);
		if (info.userMessageCallback) {
			info.userMessageCallback(response);
			info.userMessageCallback = undefined;
			info.userMessage = undefined;
			return;
		}
		info.userMessage = response;
	}

	async getUserMessage(sprout : Sprout) : Promise<Prompt> {
		const info = this.getSproutInfo(sprout);
		if (info.userMessage) {
			const message = info.userMessage;
			info.userMessage = undefined;
			info.userMessageCallback = undefined;
			return message;
		}
		return new Promise((resolve) => {
			info.userMessageCallback = resolve;
		});
	}

	//This can be called to tell a stream that is currently streaming to cancel the rest of the turn and prepare for the next turn.
	stopStreaming(sprout : Sprout) : void {
		const info = this.getSproutInfo(sprout);
		info.streamingStopped = true;
		if (info.resolveStopStreamSignal) info.resolveStopStreamSignal();
	}

	stopStreamingSignal(sprout : Sprout) : Promise<void> {
		const info = this.getSproutInfo(sprout);
		//If there isn't a signal, we need to return a promise that never resolves.
		//Callers will race this with other promises.
		return info.stopStreamSignal || new Promise(() => {});
	}

	streamingStopped(sprout : Sprout) : boolean {
		const info = this.getSproutInfo(sprout);
		return info.streamingStopped;
	}

	//This signals to the sprout to wrap it up and stop running.
	finish(sprout : Sprout) : void {
		const info = this.getSproutInfo(sprout);
		//Some callers will only race on cancelStreamSignal, so we need to cancel it too.
		this.stopStreaming(sprout);
		info.done = true;
		info.resolveDone();
	}

	//This is what things that want to know if they shoudl finish early can
	//watch.
	doneSignal(sprout : Sprout) : Promise<void> {
		const info = this.getSproutInfo(sprout);
		return info.doneSignal;
	}

	//This returns whether finish() has been called
	done(sprout : Sprout) : boolean {
		const info = this.getSproutInfo(sprout);
		return info.done;
	}
}