import { ThunkSomeAction } from '../store.js';

import {
	CLOSE_EDITOR,
	OPEN_EDITOR,
	SET_API_KEYS,
	SPROUT_STOPPED_STREAMING,
	START_EDITING,
	START_STREAMING_SPROUT,
	FORCE_CLOSE_API_KEYS_DIALOG,
	FORCE_OPEN_API_KEYS_DIALOG,
	SomeAction
} from '../actions.js';

import {
	SproutDataMap,
	SproutLocation
} from '../types.js';

import {
	selectAIProvider,
	selectAPIKeys,
	selectAttachedImage,
	selectChangesMade,
	selectCurrentSprout,
	selectCurrentSproutName,
	selectDraftMessage,
	selectEditorOpen,
	selectIsEditing,
	selectPreferredAIProvider,
	selectSproutData,
	selectSproutSnapshot,
	selectSproutStreaming
} from '../selectors.js';

import fetcher from '../../src/fetcher-browser.js';

import {
	canonicalizePath
} from './app.js';

import {
	signaller
} from '../signaller.js';

import {
	APIKeys,
	DirectoryInfo,
	ImageURL,
	ModelProvider,
	Path,
	Prompt,
	SproutName,
	SproutState,
	UncompiledPackagedSprout,
	compiledSproutSchema,
	sproutConfigSchema
} from '../../src/types.js';

import {
	addDirectoryListings,
	joinPath,
	makeFinalPath,
	normalizeSproutPath,
	sproutBaseNameLegal
} from '../../src/util.js';

import {
	emptySprout,
	packagedSproutFromUncompiled
} from '../../src/sprout.js';

import {
	Zippable,
	strToU8,
	zipSync
} from 'fflate';

import {
	TypedObject
} from '../../src/typed-object.js';

import fileSaver from 'file-saver';

import dataManager from '../data_manager.js';

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

export const setAPIKeys = (keys : APIKeys) : ThunkSomeAction => (dispatch, getState) => {
	const state = getState();
	const existing = selectAPIKeys(state);
	let changed = false;
	for (const [provider, key] of TypedObject.entries(keys)) {
		if (existing[provider] !== key) {
			changed = true;
			break;
		}
	}
	if (!changed) return;
	dispatch({
		type: SET_API_KEYS,
		keys
	});

	//Ensure the preferred provider is selected if it can be.
	const preferred = selectPreferredAIProvider(getState());
	const newKeys = selectAPIKeys(getState());
	if (newKeys[preferred]) return;
	const legalProviders = TypedObject.keys(newKeys).filter(provider => Boolean(newKeys[provider]));
	if (legalProviders.length === 0) return;
	const newPreferred = legalProviders[0];
	dispatch(setPreferredAIProvider(newPreferred));
};

export const startStreamingSprout = () : SomeAction => {
	return {
		type: START_STREAMING_SPROUT
	};
};

export const streamIncrementalMessage = (message : string) : ThunkSomeAction => (dispatch) => {
	if (message == '') return;
	dispatch({
		type: 'STREAM_INCREMENTAL_MESSAGE'
	});
};

export const sproutStoppedStreaming = (state : SproutState) : SomeAction => {
	return {
		type: SPROUT_STOPPED_STREAMING,
		state
	};
};

export const provideUserResponse = () : ThunkSomeAction => (dispatch, getState) => {
	const state = getState();
	const streaming = selectSproutStreaming(state);
	if (streaming) throw new Error('Cannot provide user response while streaming');
	const sprout = selectCurrentSprout(state);
	if (!sprout) throw new Error('No sprout');

	//TODO: don't allow submitting the text if an image is uploading

	const text = selectDraftMessage(state);
	const image = selectAttachedImage(state);

	//No message
	if (!text && !image) return;

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
	signaller.provideUserResponse(sprout, response);
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

export const openEditor = () : ThunkSomeAction => async (dispatch, getState) => {
	const state = getState();
	const alreadyOpen = selectEditorOpen(state);
	if (alreadyOpen) return;
	const sprout = selectCurrentSprout(state);
	if (!sprout) throw new Error('No current sprout');
	const snapshot = await sprout.package();
	dispatch({
		type: OPEN_EDITOR,
		snapshot
	});
};

export const closeEditor = (dismissed : boolean) : ThunkSomeAction => (dispatch, getState) => {
	const state = getState();
	const open = selectEditorOpen(state);
	if (!open) return;
	const changesMade = selectChangesMade(state);
	if (changesMade && dismissed) {
		if (!confirm('Are you sure you want to dismiss your changes?')) return;
	}
	dispatch({
		type: CLOSE_EDITOR
	});
};

export const startEditing = () : ThunkSomeAction => (dispatch, getState) => {
	const state = getState();
	const currentSprout = selectCurrentSprout(state);
	if (!currentSprout) throw new Error('No sprout');
	const isEditing = selectIsEditing(state);
	if (isEditing) throw new Error('Already editing');
	const isOpen = selectEditorOpen(state);
	if (!isOpen) {
		dispatch(openEditor());
	}
	dispatch({
		type: START_EDITING
	});
};

export const saveSprout = () : ThunkSomeAction => async (dispatch, getState) => {
	const state = getState();
	const isEditing = selectIsEditing(state);
	if (!isEditing) throw new Error('not editing');
	const snapshot = selectSproutSnapshot(state);
	if (!snapshot) throw new Error('No snapshot');
	const aiProvider = selectAIProvider(state);
	if (!aiProvider) throw new Error('No AI provider');
	const name = selectCurrentSproutName(state);
	if (name === null) throw new Error('no name');
	//These next two steps can take some time, so close the editor first, so the user knows the button did something.
	dispatch(closeEditor(false));
	const pkg = await packagedSproutFromUncompiled(snapshot, aiProvider);
	await dataManager.writeSprout(name, pkg);
};

export const editingModifySprout = (snapshot : UncompiledPackagedSprout) : ThunkSomeAction => async (dispatch, getState) => {
	const state = getState();
	const editing = selectIsEditing(state);
	if (!editing) throw new Error('Not editing');
	dispatch({
		type: 'EDITING_MODIFY_SPROUT',
		snapshot
	});
};

export const createNamedSprout = (name : SproutName) : ThunkSomeAction =>  async (dispatch) => {
	if (!sproutBaseNameLegal(name)) {
		throw new Error(`${name} is not a legal sprout base name`);
	}

	const fullName = joinPath(fetcher.localWriteablePath, name);

	const sproutExists = await dataManager.sproutExists(fullName);
	if (sproutExists) throw new Error(`Sprout ${fullName} already exists`);

	const sprout = await emptySprout(name, `A sprout called ${name}`);
	await dataManager.writeSprout(fullName, sprout);
	dispatch(addOrSelectSprout(fullName));
	dispatch(startEditing());
};

export const forkCurrentSprout = (newName : SproutName) : ThunkSomeAction => async (dispatch, getState) => {
	const currentSprout = selectCurrentSprout(getState());
	if (!currentSprout) throw new Error('No current sprout');

	if (!sproutBaseNameLegal(newName)) {
		throw new Error(`${newName} is not a legal sprout base name`);
	}

	const fullName = joinPath(fetcher.localWriteablePath, newName);

	const sproutExists = await dataManager.sproutExists(fullName);
	if (sproutExists) throw new Error(`Sprout ${fullName} already exists`);

	const sproutPackage = await currentSprout.compiledPackage();
	const pkg = {
		...sproutPackage
	};

	const forkedFrom = makeFinalPath(currentSprout.name);

	//TODO: this is a total hack to set the forkedFrom field, ideally there
	//would be a more formal way of doing this.
	const config = sproutConfigSchema.parse(JSON.parse(pkg['sprout.json']));
	const compiled = compiledSproutSchema.parse(JSON.parse(pkg['sprout.compiled.json']));

	config.forkedFrom = forkedFrom;
	compiled.config.forkedFrom = forkedFrom;

	pkg['sprout.json'] = JSON.stringify(config);
	pkg['sprout.compiled.json'] = JSON.stringify(compiled);

	await dataManager.writeSprout(fullName, pkg);
	dispatch(addOrSelectSprout(fullName));
	dispatch(startEditing());
};

const zippableBundle = (info : DirectoryInfo) : Zippable => {
	const data : Zippable = {};
	for (const [filename, contents] of Object.entries(info)) {
		if (typeof contents === 'string') {
			data[filename] = strToU8(contents);
			continue;
		}
		data[filename] = zippableBundle(contents);
	}
	return data;
};

export const downloadCurrentSprout = () : ThunkSomeAction => async (dispatch, getState) => {
	const state = getState();
	const name = selectCurrentSproutName(state);
	if (!name) throw new Error('No current sprout');
	const sprout = selectCurrentSprout(state);
	if (!sprout) throw new Error('No sprout');

	const lastNamePart = name.split('/').pop();
	if (!lastNamePart) throw new Error('No last name part');

	const pkg = await sprout.compiledPackage();
	//Add directory.json listings
	addDirectoryListings(pkg);

	//We want the sprout, when unzipped, to not put its files in the directory
	//it was unzipped in, but a subdirectory.
	const finalPkg : DirectoryInfo = {
		[lastNamePart]: pkg
	};

	const data = zippableBundle(finalPkg);
	const zipped = zipSync(data);
	const blob = new Blob([zipped], {type: 'application/zip'});

	fileSaver.saveAs(blob, `${lastNamePart}.zip`);


};

export const forceOpenAPIKeysDialog = () : SomeAction => {
	return {
		type: FORCE_OPEN_API_KEYS_DIALOG
	};
};

export const forceClosedAPIKeysDialog = () : SomeAction => {
	return {
		type: FORCE_CLOSE_API_KEYS_DIALOG
	};
};

export const setPreferredAIProvider = (provider : ModelProvider) : ThunkSomeAction => (dispatch, getState) => {
	const state = getState();
	const currentProvider = selectPreferredAIProvider(state);
	if (currentProvider === provider) return;
	dispatch({
		type: 'SET_PREFERRED_AI_PROVIDER',
		provider
	});
};