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
	selectConversation,
	selectCurrentSproutName,
	selectSproutData
} from '../selectors.js';

import fetcher from '../../src/fetcher-browser.js';

import {
	canonicalizePath
} from './app.js';

import {
	Signaller
} from '../runner.js';

import {
	Path,
	Prompt
} from '../../src/types.js';

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
	if (sprout === selectCurrentSproutName(getState())) {
		//Already selected
		return;
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

export const streamIncrementalMessage = (message : string) : ThunkSomeAction => (dispatch, getState) => {
	if (message == '') return;
	const conversation = selectConversation(getState());
	if (conversation.length === 0) {
		throw new Error('No conversation to add to');
	}
	if (conversation[conversation.length - 1].speaker !== 'sprout') {
		throw new Error('Last message in conversation was not from sprout');
	}
	dispatch({
		type: 'STREAM_INCREMENTAL_MESSAGE',
		message
	});
};

export const sproutStoppedStreaming = () : SomeAction => {
	return {
		type: SPROUT_STOPPED_STREAMING
	};
};

export const provideUserResponse = (response : Prompt, signaller : Signaller) : ThunkSomeAction => (dispatch) => {
	dispatch({
		type: 'SPROUT_PROVIDED_USER_RESPONSE',
		response
	});
	signaller.provideUserResponse(response);
};

export const addDefaultSprouts = () : ThunkSomeAction => async (dispatch) => {
	const sprouts = await fetcher.listSprouts();
	dispatch(addSprouts(Object.fromEntries(sprouts.map(sprout => [sprout, true]))));
};

export const addSprout = (sproutLocation : Path) : ThunkSomeAction => async (dispatch) => {
	dispatch(addSprouts({[sproutLocation]: true}));
	dispatch(selectSprout(sproutLocation));
};

export const updateWithMainPageExtra = (pageExtra : string) : ThunkSomeAction => (dispatch) => {
	const parts = pageExtra.split('/');
	//The last piece is the trailing slash
	parts.pop();
	const sproutName = parts.join('/');
	dispatch(selectSprout(sproutName, true));
};

export const updateDraftMessage = (message : string) : SomeAction => {
	return {
		type: 'UPDATE_DRAFT_MESSAGE',
		message
	};
};