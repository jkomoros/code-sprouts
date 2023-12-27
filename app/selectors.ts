import {
	RootState
} from './types_store.js';

export const selectPage = (state : RootState) => state.app ? state.app.page : '';
export const selectPageExtra = (state : RootState) => state.app ? state.app.pageExtra : '';
export const selectHash = (state : RootState) => state.app ? state.app.hash : '';

export const selectHasOpenAIAPIKey = (state : RootState) => state.data ? Boolean(state.data.openAIAPIKey) : false;

export const selectHashForCurrentState = (_state : RootState) => '';