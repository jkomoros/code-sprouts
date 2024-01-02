import {
	createSelector
} from 'reselect';

import {
	RootState
} from './types_store.js';

import {
	Sprout
} from '../src/sprout.js';

import {
	AIProvider
} from '../src/llm.js';

export const selectPage = (state : RootState) => state.app ? state.app.page : '';
export const selectPageExtra = (state : RootState) => state.app ? state.app.pageExtra : '';
export const selectHash = (state : RootState) => state.app ? state.app.hash : '';

export const selectCurrentSproutName = (state : RootState) => state.data ? state.data.currentSproutName : null;
export const selectSproutData = (state : RootState) => state.data ? state.data.sprouts : {};
export const selectSproutStreaming = (state : RootState) => state.data ? state.data.sproutStreaming : false;
export const selectStreamCounter = (state : RootState) => state.data ? state.data.streamCounter : 0;
export const selectDraftMessage = (state : RootState) => state.data ? state.data.draftMessage : '';
export const selectAttachedImage = (state : RootState) => state.data ? state.data.attachedImage : null;
export const selectOpenAIAPIKey = (state : RootState) => state.data ? state.data.openAIAPIKey : '';
export const selectEditorOpen = (state : RootState) => state.data ? state.data.editorOpen : false;
export const selectWrittenSprouts = (state : RootState) => state.data ? state.data.writtenSprouts : {};

export const selectHashForCurrentState = (_state : RootState) => '';

export const selectAIProvider = createSelector(
	selectOpenAIAPIKey,
	(apiKey) => apiKey ? new AIProvider({openai_api_key: apiKey}) : null
);

export const selectCurrentSprout = createSelector(
	selectCurrentSproutName,
	selectAIProvider,
	(sproutName, aiProvider) => {
		if (!sproutName) return null;
		if (!aiProvider) return null;
		//TODO: only include if user wants it.
		const debugLogger = (msg : string) => console.log(msg);
		return new Sprout(sproutName, {
			ai: aiProvider,
			debugLogger,
			disallowCompilation: true
		});
	}
);

export const selectCurrentSproutConversation = createSelector(
	selectCurrentSprout,
	//Stream counter will increment as a nonce whenever the converastion might have changed
	selectStreamCounter,
	//We have to return a copy of the conversation, otherwise the sproutView element won't notice anything changed.
	(sprout, _streamCounter) => sprout ? [...sprout.conversation] : []
);