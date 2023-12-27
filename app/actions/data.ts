import { ThunkSomeAction } from '../store.js';

import {
	SET_OPENAI_API_KEY,
	SomeAction
} from '../actions.js';

import {
	SproutDataMap, SproutLocation
} from '../types.js';

import {
	selectSproutData
} from '../selectors.js';

export const addSprouts = (sprouts : SproutDataMap) : SomeAction => {
	return {
		type: 'ADD_SPROUTS',
		sprouts
	};
};

export const selectSprout = (sprout : SproutLocation) : ThunkSomeAction => (dispatch, getState) => {
	const sprouts = selectSproutData(getState());
	if (!sprouts[sprout]) {
		throw new Error(`No sprout with id ${sprout}`);
	}
	dispatch({
		type: 'SELECT_SPROUT',
		sprout
	});
};

export const setOpenAIAPIKey = (key : string) : ThunkSomeAction => (dispatch) => {
	dispatch({
		type: SET_OPENAI_API_KEY,
		key
	});
};
