import {
	ADD_SPROUTS,
	ATTACH_IMAGE,
	CLOSE_EDITOR,
	EDITING_MODIFY_SPROUT,
	FORCE_CLOSE_API_KEYS_DIALOG,
	FORCE_OPEN_API_KEYS_DIALOG,
	OPEN_EDITOR,
	REMOVE_SPROUTS,
	SELECT_SPROUT,
	SET_API_KEYS,
	SET_PREFERRED_AI_PROVIDER,
	SPROUT_PROVIDED_USER_RESPONSE,
	SPROUT_STOPPED_STREAMING,
	START_EDITING,
	START_STREAMING_SPROUT,
	STREAM_INCREMENTAL_MESSAGE,
	SomeAction,
	UPDATE_DRAFT_MESSAGE,
	WRITE_SPROUT
} from '../actions.js';

import {
	DataState
} from '../types_store.js';

const INITIAL_STATE : DataState = {
	apiKeys: {
		'openai.com': '',
		'anthropic.com': ''
	},
	apiKeysEditorForcedOpen: false,
	preferredAIProvider: 'openai.com',
	sprouts: {},
	currentSproutName: null,
	sproutStreaming: false,
	streamCounter: 0,
	draftMessage: '',
	attachedImage: null,
	editorOpen: false,
	editing: false,
	changesMade: false,
	sproutSnapshot: null,
	writtenSprouts: {}
};

const data = (state : DataState = INITIAL_STATE, action : SomeAction) : DataState => {

	switch (action.type) {
	case SET_API_KEYS:
		return {
			...state,
			apiKeys: {
				...state.apiKeys,
				...action.keys
			}
		};
	case ADD_SPROUTS:
		return {
			...state,
			sprouts: {
				...state.sprouts,
				...action.sprouts
			}
		};
	case REMOVE_SPROUTS:
		return {
			...state,
			sprouts: Object.fromEntries(Object.entries(state.sprouts).filter(([name, _]) => !(name in action.sprouts))),
			writtenSprouts: Object.fromEntries(Object.entries(state.writtenSprouts).filter(([name, _]) => !(name in action.sprouts)))
		};
	case SELECT_SPROUT:
		return {
			...state,
			currentSproutName: action.sprout,
		};
	case START_STREAMING_SPROUT:
		return {
			...state,
			sproutStreaming: true,
			streamCounter: state.streamCounter + 1
		};
	case STREAM_INCREMENTAL_MESSAGE:
		return {
			...state,
			streamCounter: state.streamCounter + 1
		};
	case SPROUT_STOPPED_STREAMING:
		return {
			...state,
			sproutStreaming: false,
			streamCounter: state.streamCounter + 1
		};
	case SPROUT_PROVIDED_USER_RESPONSE:
		return {
			...state,
			draftMessage: '',
			attachedImage: null
		};
	case UPDATE_DRAFT_MESSAGE:
		return {
			...state,
			draftMessage: action.message
		};
	case ATTACH_IMAGE:
		return {
			...state,
			attachedImage: action.image
		};
	case OPEN_EDITOR:
		return {
			...state,
			editorOpen: true,
			sproutSnapshot: action.snapshot
		};
	case CLOSE_EDITOR:
		return {
			...state,
			editorOpen: false,
			editing: false,
			sproutSnapshot: null
		};
	case START_EDITING:
		return {
			...state,
			editorOpen: true,
			editing: true
		};
	case EDITING_MODIFY_SPROUT:
		return {
			...state,
			changesMade: true,
			sproutSnapshot: action.snapshot,
		};
	case WRITE_SPROUT:
		return {
			...state,
			writtenSprouts: {
				...state.writtenSprouts,
				[action.name]: action.sprout
			}
		};
	case FORCE_OPEN_API_KEYS_DIALOG:
		return {
			...state,
			apiKeysEditorForcedOpen: true
		};
	case FORCE_CLOSE_API_KEYS_DIALOG:
		return {
			...state,
			apiKeysEditorForcedOpen: false
		};
	case SET_PREFERRED_AI_PROVIDER:
		return {
			...state,
			preferredAIProvider: action.provider
		};
	default:
		return state;
	}
};

export default data;
