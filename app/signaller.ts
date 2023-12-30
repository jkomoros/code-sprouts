import {
	ConversationSignaller
} from '../src/signaller.js';

import {
	store
} from './store.js';

import {
	startStreamingSprout,
	sproutStoppedStreaming,
	streamIncrementalMessage
} from './actions/data.js';

import {
	SproutState
} from '../src/types.js';

import {
	Sprout
} from '../src/sprout.js';

class BrowserConversationSignaller extends ConversationSignaller {
	override async streamStarted(): Promise<void> {
		store.dispatch(startStreamingSprout());
	}

	override async streamStopped(_sprout : Sprout, state: SproutState): Promise<void> {
		store.dispatch(sproutStoppedStreaming(state));
	}

	override streamIncrementalMessage(_sprout : Sprout, message: string): void {
		store.dispatch(streamIncrementalMessage(message));
	}
}

export const signaller = new BrowserConversationSignaller();