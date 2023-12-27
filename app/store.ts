import {
	createStore,
	compose,
	applyMiddleware,
	combineReducers,
	Reducer
} from 'redux';

import { 
	thunk,
	ThunkAction,
	ThunkMiddleware
} from 'redux-thunk';

import {
	AppState,
	DataState,
	RootState
} from './types_store.js';

import {
	SomeAction
} from './actions.js';

import app from './reducers/app.js';
import data from './reducers/data.js';

declare global {
	interface Window {
		process?: object;
		DEBUG_STORE: object;
		__REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
	}
  }

//Create store using Thunk middleware and app and data sub-reducers
export const store = createStore(
	combineReducers({
		app,
		data
	}) as Reducer<Partial<{ app: AppState; data: DataState; }>, SomeAction>,
	// Apply thunk middleware
	compose(
		//Install thunk middleware expecting RootState and SomeAction.
		applyMiddleware(thunk as ThunkMiddleware<RootState, SomeAction>),
	)
);

export type ThunkSomeAction = ThunkAction<void, RootState, undefined, SomeAction>;
