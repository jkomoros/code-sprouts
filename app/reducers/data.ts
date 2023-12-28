import {
	ADD_SPROUTS,
	SELECT_SPROUT,
	SET_OPENAI_API_KEY,
	SPROUT_PROVIDED_USER_RESPONSE,
	SPROUT_STOPPED_STREAMING,
	START_STREAMING_SPROUT,
	STREAM_INCREMENTAL_MESSAGE,
	SomeAction
} from '../actions.js';

import {
	DataState
} from '../types_store.js';

const INITIAL_STATE : DataState = {
	openAIAPIKey: '',
	sprouts: {},
	currentSproutName: null,
	sproutStreaming: false,
	conversation: []
};

const data = (state : DataState = INITIAL_STATE, action : SomeAction) : DataState => {

	switch (action.type) {
	case SET_OPENAI_API_KEY:
		return {
			...state,
			openAIAPIKey: action.key
		};
	case ADD_SPROUTS:
		return {
			...state,
			sprouts: {
				...state.sprouts,
				...action.sprouts
			}
		};
	case SELECT_SPROUT:
		return {
			...state,
			currentSproutName: action.sprout
		};
	case START_STREAMING_SPROUT:
		return {
			...state,
			sproutStreaming: true,
			conversation: [
				...state.conversation,
				{
					speaker: 'sprout',
					message: ''
				}
			]
		};
	case STREAM_INCREMENTAL_MESSAGE:
		return {
			...state,
			conversation: [
				...state.conversation.slice(0, state.conversation.length - 1),
				{
					speaker: 'sprout',
					message: state.conversation[state.conversation.length - 1].message + action.message
				}
			]
		};
	case SPROUT_STOPPED_STREAMING:
		return {
			...state,
			sproutStreaming: false
		};
	case SPROUT_PROVIDED_USER_RESPONSE:
		return {
			...state,
			conversation: [
				...state.conversation,
				{
					speaker: 'user',
					message: action.response
				}
			]
		};
	default:
		return state;
	}
};

export default data;
