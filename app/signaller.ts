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

export class BrowserConversationSignaller extends ConversationSignaller {
	override streamStarted(): void {
		store.dispatch(startStreamingSprout());
	}

	override streamStopped(_sprout : Sprout, state: SproutState): void {
		store.dispatch(sproutStoppedStreaming(state));
	}

	override streamIncrementalMessage(_sprout : Sprout, message: string): void {
		store.dispatch(streamIncrementalMessage(message));
	}
}