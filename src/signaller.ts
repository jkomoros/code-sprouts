import {
	Sprout
} from './sprout.js';

import {
	Prompt,
	SproutState
} from './types.js';

type SignallerSproutInfo = {
	userMessageCallback? : (response : Prompt) => void,
	userMessageReject? : (error : Error) => void,
	userMessage? : Prompt,
	done : boolean
}

export class StreamCancelledError extends Error {
	streamCancelledError = true;
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
			info.userMessageReject = undefined;
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
			info.userMessageReject = undefined;
			return message;
		}
		return new Promise<Prompt>((resolve, reject) => {
			info.userMessageCallback = resolve;
			info.userMessageReject = reject;
		});
	}

	finish(sprout : Sprout) : void {
		const info = this.getSproutInfo(sprout);
		info.done = true;
		if (info.userMessageReject) {
			info.userMessageReject(new StreamCancelledError('Stream cancelled'));
			info.userMessageReject = undefined;
		}
	}

	done(sprout : Sprout) : boolean {
		const info = this.getSproutInfo(sprout);
		return info.done;
	}
}