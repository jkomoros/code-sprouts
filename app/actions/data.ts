import { ThunkSomeAction } from '../store.js';

import {
	SET_OPENAI_API_KEY,
	SomeAction
} from '../actions.js';

import {
	SproutDataMap
} from '../types.js';

export const addSprouts = (sprouts : SproutDataMap) : SomeAction => {
	return {
		type: 'ADD_SPROUTS',
		sprouts
	};
};

export const setOpenAIAPIKey = (key : string) : ThunkSomeAction => (dispatch) => {
	dispatch({
		type: SET_OPENAI_API_KEY,
		key
	});
};
