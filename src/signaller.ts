import { Sprout } from './sprout.js';
import {
	Prompt,
	SproutState
} from './types.js';

export abstract class ConversationSignaller {
	private _done = false;
	private _userMessageCallback : ((response : Prompt) => void) | null = null;
	private _userMessage : Prompt | null = null;

	//Async methods
	abstract streamStarted(sprout : Sprout) : Promise<void>;
	abstract streamStopped(sprout : Sprout, state : SproutState): Promise<void>;
	//This isn't async
	abstract streamIncrementalMessage(sprout : Sprout, message : string): void;

	//TODO: this should also take sprout.
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