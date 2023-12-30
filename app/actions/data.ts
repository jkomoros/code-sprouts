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
	selectAttachedImage,
	selectConversation,
	selectCurrentSproutName,
	selectDraftMessage,
	selectSproutData,
	selectSproutStreaming
} from '../selectors.js';

import fetcher from '../../src/fetcher-browser.js';

import {
	canonicalizePath
} from './app.js';

import {
	Signaller
} from '../runner.js';

import {
	ImageURL,
	Path,
	Prompt,
	SproutState
} from '../../src/types.js';

import {
	normalizeSproutPath
} from '../../src/util.js';

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

export const addOrSelectSprout = (sprout : SproutLocation) : ThunkSomeAction => (dispatch, getState) => {
	const sprouts = selectSproutData(getState());
	if (!sprouts[sprout]) {
		dispatch(addSprout(sprout));
	}
	dispatch(selectSprout(sprout, false));
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

export const sproutStoppedStreaming = (state : SproutState) : SomeAction => {
	return {
		type: SPROUT_STOPPED_STREAMING,
		state
	};
};

export const provideUserResponse = (signaller : Signaller) : ThunkSomeAction => (dispatch, getState) => {
	const state = getState();
	const streaming = selectSproutStreaming(state);
	if (streaming) throw new Error('Cannot provide user response while streaming');

	//TODO: don't allow submitting the text if an image is uploading

	const text = selectDraftMessage(state);
	const image = selectAttachedImage(state);
	const response : Prompt = image ? [
		text,
		{
			image
		}
	] : text;

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
	sproutLocation = normalizeSproutPath(sproutLocation);
	dispatch(addSprouts({[sproutLocation]: true}));
	dispatch(selectSprout(sproutLocation));
};

export const updateWithMainPageExtra = (pageExtra : string) : ThunkSomeAction => (dispatch) => {
	const parts = pageExtra.split('/');
	//The last piece is the trailing slash
	parts.pop();
	const sproutName = parts.join('/');
	dispatch(addOrSelectSprout(sproutName));
};

export const updateDraftMessage = (message : string) : SomeAction => {
	return {
		type: 'UPDATE_DRAFT_MESSAGE',
		message
	};
};

const getImageURL = async (file : File | null) : Promise<ImageURL | null> => {
	if (!file) return null;
	if (!file.type.startsWith('image/')) throw new Error('Not an image');
	const promise = new Promise<ImageURL>((resolve) => {
		const reader = new FileReader();		
		reader.onload = () => {
			//We told it to be a dataURL so it's a file
			resolve(reader.result as string);
		};
		//TODO: resize the image
		reader.readAsDataURL(file);
	});

	return promise;
};

export const attachImage = (file : File | null) : ThunkSomeAction => async (dispatch) => {
	const image = await getImageURL(file);
	dispatch({
		type: 'ATTACH_IMAGE',
		image
	});
};