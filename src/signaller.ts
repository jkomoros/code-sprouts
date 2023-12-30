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
	//What streamLogger passes from conversationTurn
	abstract streamIncrementalMessage(sprout : Sprout, message : string): void;
	//What debugStreamLogger passes from converastionTurn.
	streamIncrementalDebugMessage(_sprout : Sprout, _debugMessage : string) : void {
		//By default does nothing
	}

	provideUserResponse(_sprout : Sprout, response : Prompt) : void {
		if (this._userMessageCallback) {
			this._userMessageCallback(response);
			this._userMessageCallback = null;
			this._userMessage = null;
			return;
		}
		this._userMessage = response;
	}

	async getUserMessage(_sprout : Sprout) : Promise<Prompt> {
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

	finish(_sprout : Sprout) : void {
		this._done = true;
	}

	done(_sprout : Sprout) : boolean {
		return this._done;
	}
}