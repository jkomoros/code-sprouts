import {
	ADD_SPROUTS,
	SELECT_SPROUT,
	SET_OPENAI_API_KEY,
	SomeAction
} from '../actions.js';

import {
	DataState
} from '../types_store.js';

const INITIAL_STATE : DataState = {
	openAIAPIKey: '',
	sprouts: {},
	currentSprout: null
};

const data = (state : DataState = INITIAL_STATE, action : SomeAction) : DataState => {

	switch (action.type) {
	case SET_OPENAI_API_KEY:
		return {
			...state,
			openAIAPIKey: action.key
		};
	case ADD_SPROUTS:
		const newSprouts = {
			...state.sprouts,
			...action.sprouts
		};
		return {
			...state,
			sprouts: newSprouts,
			currentSprout: state.currentSprout || Object.keys(newSprouts)[0] || null
		};
	case SELECT_SPROUT:
		return {
			...state,
			currentSprout: action.sprout
		};
	default:
		return state;
	}
};

export default data;
