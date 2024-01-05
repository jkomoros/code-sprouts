import { Sprout } from './sprout.js';
import {
	Prompt,
	SproutState
} from './types.js';

type SignallerSproutInfo = {
	userMessageCallback? : (response : Prompt) => void,
	userMessage? : Prompt,
	doneSignal : Promise<void>,
	resolveDone : () => void,
	done : boolean
}

//In a method to close over the thing we create.
const createSproutInfo = () : SignallerSproutInfo => {
	const info : Partial<SignallerSproutInfo> = {
		done: false,
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

	//This signals to the sprout to wrap it up and stop running.
	finish(sprout : Sprout) : void {
		const info = this.getSproutInfo(sprout);
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