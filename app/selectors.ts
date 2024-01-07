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

import {
	fetcher
} from './fetcher.js';

import {
	APIKeys
} from '../src/types.js';

export const selectPage = (state : RootState) => state.app ? state.app.page : '';
export const selectPageExtra = (state : RootState) => state.app ? state.app.pageExtra : '';
export const selectHash = (state : RootState) => state.app ? state.app.hash : '';
export const selectMobile = (state : RootState) => state.app ? state.app.mobile : false;

export const selectCurrentSproutName = (state : RootState) => state.data ? state.data.currentSproutName : null;
export const selectSproutData = (state : RootState) => state.data ? state.data.sprouts : {};
export const selectSproutStreaming = (state : RootState) => state.data ? state.data.sproutStreaming : false;
export const selectStreamCounter = (state : RootState) => state.data ? state.data.streamCounter : 0;
export const selectDraftMessage = (state : RootState) => state.data ? state.data.draftMessage : '';
export const selectAttachedImage = (state : RootState) => state.data ? state.data.attachedImage : null;
export const selectAPIKeys = (state : RootState) : APIKeys => state.data ? state.data.apiKeys : {};
export const selectEditorOpen = (state : RootState) => state.data ? state.data.editorOpen : false;
export const selectIsEditing = (state : RootState) => state.data ? state.data.editing : false;
export const selectChangesMade = (state : RootState) => state.data ? state.data.changesMade : false;
export const selectSproutSnapshot = (state : RootState) => state.data ? state.data.sproutSnapshot : null;
export const selectWrittenSprouts = (state : RootState) => state.data ? state.data.writtenSprouts : {};
export const selectPreferredAIProvider = (state : RootState) => state.data ? state.data.preferredAIProvider : 'openai.com';
const selectAPIKeysEditorForcedOpen = (state : RootState) => state.data ? state.data.apiKeysEditorForcedOpen : false;

export const selectHashForCurrentState = (_state : RootState) => '';

export const selectOpenAIAPIKey = createSelector(
	selectAPIKeys,
	(keys) => keys['openai.com'] || ''
);

export const selectAnthropicAPIKey = createSelector(
	selectAPIKeys,
	(keys) => keys['anthropic.com'] || ''
);

export const selectAPIKeysDialogAutoOpen = createSelector(
	selectAPIKeys,
	(keys) => !Object.values(keys).some(str => Boolean(str))
);

export const selectAPIKeysDialogOpen = createSelector(
	selectAPIKeysDialogAutoOpen,
	selectAPIKeysEditorForcedOpen,
	(autoOpen, forcedOpen) => autoOpen || forcedOpen
);

//This will be a convenient place to extend later.
export const selectDialogOpen = createSelector(
	selectEditorOpen,
	selectAPIKeysDialogOpen,
	(editorOpen, apiKeysOpen) => editorOpen || apiKeysOpen
);

export const selectAIProvider = createSelector(
	selectAPIKeys,
	(keys) => Object.keys(keys).length && Object.values(keys).some(str => Boolean(str)) ? new AIProvider(keys) : null
);

const selectWrittenSproutDataForCurrentSprout = createSelector(
	selectCurrentSproutName,
	selectWrittenSprouts,
	(sproutName, writtenSprouts) => sproutName ? writtenSprouts[sproutName] : null
);

export const selectCurrentSprout = createSelector(
	selectCurrentSproutName,
	selectAIProvider,
	selectWrittenSproutDataForCurrentSprout,
	//We only select _writtenData so that if there was a write to our files, we will reload it.
	(sproutName, aiProvider, _writtenData) => {
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

//In the future there will be much more complex logic.
export const selectMayCreateSprout = (_state : RootState) => true;

//In the future more logic might be here.
export const selectMayEditCurrentSprout = createSelector(
	selectCurrentSproutName,
	(sproutName) => fetcher.pathIsLocalWriteable(sproutName || '')
);