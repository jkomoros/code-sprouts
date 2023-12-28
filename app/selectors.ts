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
export const selectOpenAIAPIKey = (state : RootState) => state.data ? state.data.openAIAPIKey : '';

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
		return new Sprout(sproutName, {
			ai: aiProvider
		});
	}
);