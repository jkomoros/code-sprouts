import { Sprout } from './sprout.js';
import {
	Prompt,
	SproutState
} from './types.js';

type SignallerSproutInfo = {
	userMessageCallback? : (response : Prompt) => void,
	userMessage? : Prompt,
	done : boolean
}

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
			info = {done: false};
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

	finish(sprout : Sprout) : void {
		const info = this.getSproutInfo(sprout);
		info.done = true;
	}

	done(sprout : Sprout) : boolean {
		const info = this.getSproutInfo(sprout);
		return info.done;
	}
}