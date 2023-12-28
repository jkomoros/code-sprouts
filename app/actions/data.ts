import { ThunkSomeAction } from '../store.js';

import {
	SET_OPENAI_API_KEY,
	SPROUT_STOPPED_STREAMING,
	START_STREAMING_SPROUT,
	SomeAction
} from '../actions.js';

import {
	SproutDataMap, SproutLocation
} from '../types.js';

import {
	selectCurrentSproutName,
	selectSproutData
} from '../selectors.js';

import fetcher from '../../src/fetcher-browser.js';

import {
	canonicalizePath
} from './app.js';

export const addSprouts = (sprouts : SproutDataMap) : ThunkSomeAction => (dispatch, getState) => {
	dispatch({
		type: 'ADD_SPROUTS',
		sprouts
	});

	const state = getState();

	const currentSprout = selectCurrentSproutName(state);
	if (currentSprout) return;

	const sproutNames = Object.keys(sprouts);
	if (sproutNames.length === 0) return;
	dispatch(selectSprout(sproutNames[0]));
};

export const selectSprout = (sprout : SproutLocation, skipCanonicalize = false) : ThunkSomeAction => (dispatch, getState) => {
	const sprouts = selectSproutData(getState());
	if (!sprouts[sprout]) {
		throw new Error(`No sprout with id ${sprout}`);
	}
	dispatch({
		type: 'SELECT_SPROUT',
		sprout
	});
	if (!skipCanonicalize) dispatch(canonicalizePath());
};

export const setOpenAIAPIKey = (key : string) : ThunkSomeAction => (dispatch) => {
	dispatch({
		type: SET_OPENAI_API_KEY,
		key
	});
};

export const startStreamingSprout = () : SomeAction => {
	return {
		type: START_STREAMING_SPROUT
	};
};

export const sproutStoppedStreaming = () : SomeAction => {
	return {
		type: SPROUT_STOPPED_STREAMING
	};
};

export const addDefaultSprouts = () : ThunkSomeAction => async (dispatch) => {
	const sprouts = await fetcher.listSprouts();
	dispatch(addSprouts(Object.fromEntries(sprouts.map(sprout => [sprout, true]))));
};

export const updateWithMainPageExtra = (pageExtra : string) : ThunkSomeAction => (dispatch) => {
	const parts = pageExtra.split('/');
	//The last piece is the trailing slash
	parts.pop();
	const sproutName = parts.join('/');
	dispatch(selectSprout(sproutName, true));
};
