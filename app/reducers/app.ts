import {
	UPDATE_PAGE,
	UPDATE_OFFLINE,
	UPDATE_HASH,
	SomeAction,
	UPDATE_MOBILE,
} from '../actions.js';

import {
	AppState
} from '../types_store.js';

const INITIAL_STATE : AppState = {
	page: '',
	pageExtra: '',
	offline: false,
	mobile: false,
	hash: '',
};

const app = (state : AppState = INITIAL_STATE, action : SomeAction) : AppState => {
	switch (action.type) {
	case UPDATE_PAGE:
		return {
			...state,
			page: action.page,
			pageExtra: action.pageExtra,
		};
	case UPDATE_OFFLINE:
		return {
			...state,
			offline: action.offline
		};
	case UPDATE_HASH:
		return {
			...state,
			hash: action.hash
		};
	case UPDATE_MOBILE:
		return {
			...state,
			mobile: action.mobile
		};
	default:
		return state;
	}
};

export default app;
