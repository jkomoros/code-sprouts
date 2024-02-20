import {
	UPDATE_PAGE,
	UPDATE_OFFLINE,
	UPDATE_HASH,
	UPDATE_MOBILE
} from '../actions.js';

import {
	selectCurrentSproutName,
	selectHash,
	selectHashForCurrentState,
	selectMobile,
	selectPage,
	selectPageExtra,
} from '../selectors.js';

import {
	ThunkSomeAction
} from '../store.js';

import {
	SPROUT_VIEW_PATH,
	URLHashArgs,
	urlHashArgs
} from '../types.js';

import {
	SproutName
} from '../../src/types.js';

export const navigateToSproutByName = (name : SproutName) : ThunkSomeAction => (dispatch) => {
	dispatch(navigatePathTo(SPROUT_VIEW_PATH + '/' + name));
};

//if silent is true, then just passively updates the URL to reflect what it should be.
export const navigatePathTo = (path : string, silent = false): ThunkSomeAction => (dispatch) => {
	//If we're already pointed there, no need to navigate
	if ('/' + path === window.location.pathname) return;
	//Don't replace search or hash if they exist. If htey don't exist, these
	//will be '', but if they do exist they will have the '?' and '#' prepended.
	path = path + window.location.search + window.location.hash;
	if (silent) {
		window.history.replaceState({}, '', path);
		return;
	}
	window.history.pushState({}, '', path);
	dispatch(navigate(path));
};

export const canonicalizePath = () : ThunkSomeAction => (dispatch ,getState) => {

	const state = getState();

	const page = selectPage(state);
	const pageExtra = selectPageExtra(state);

	const path = [page];
	
	switch(page) {
	case SPROUT_VIEW_PATH:
		const sprout = selectCurrentSproutName(state);
		if (sprout) path.push(sprout);
		path.push(''); //Add a trailing slash
		break;
	default:
		path.push(pageExtra);
		break;
	}

	dispatch(navigatePathTo(path.join('/'), true));
};

export const navigate = (path : string) : ThunkSomeAction => (dispatch) => {
	// Extract the page name from path.
	const page = path === '/' ? SPROUT_VIEW_PATH : path.slice(1);

	// Any other info you might want to extract from the path (like page type),
	// you can do here
	dispatch(loadPage(page));
};

const loadPage  = (location : string) : ThunkSomeAction => (dispatch) => {

	const pieces = location.split('/');

	let page = pieces[0];
	const pageExtra = pieces.length < 2 ? '' : pieces.slice(1).join('/');

	switch(page) {
	case SPROUT_VIEW_PATH:
		import('../components/sprout-view.js');
		break;
	default:
		page = 'view404';
		import('../components/my-view404.js');
	}

	dispatch(updatePage(page, pageExtra));
};

const updatePage = (page : string, pageExtra : string) : ThunkSomeAction => (dispatch, getState) => {
	const state = getState();
	const currentPage = selectPage(state);
	const currentPageExtra = selectPageExtra(state);
	if (currentPage == page && currentPageExtra == pageExtra) return;
	dispatch({
		type: UPDATE_PAGE,
		page,
		pageExtra,
	});
};

export const updateOffline = (offline : boolean) : ThunkSomeAction => (dispatch) => {
	dispatch({
		type: UPDATE_OFFLINE,
		offline
	});
};

export const updateMobile = (mobile : boolean) : ThunkSomeAction => (dispatch, getState) => {
	const state = getState();
	const current = selectMobile(state);
	if (current == mobile) return;
	dispatch({
		type: UPDATE_MOBILE,
		mobile
	});
};

export const canonicalizeHash = () : ThunkSomeAction => (dispatch, getState) => {
	const state = getState();
	const hash = selectHashForCurrentState(state);
	dispatch(updateHash(hash));
};

const parseHash = (hash : string) : URLHashArgs => {
	if (hash.startsWith('#')) hash = hash.substring(1);
	const args : Record<string, string> = {};
	if (!hash) return {};
	for (const part of hash.split('&')) {
		const [key, val] = part.split('=');
		args[key] = decodeURIComponent(val);
	}
	return urlHashArgs.parse(args);
};

const ingestHash = (hash : string) : ThunkSomeAction => () => {
	//No state to store.
	const _ = parseHash(hash);
};

export const updateHash = (hash : string, comesFromURL = false) : ThunkSomeAction => (dispatch, getState) => {
	if (hash.startsWith('#')) hash = hash.substring(1);
	const state = getState();
	const currentHash = selectHash(state);
	if (hash == currentHash) return;
	if (comesFromURL) {
		dispatch(ingestHash(hash));
	} else {
		window.location.hash = hash;
		//Clear the '#'
		if (!hash) history.replaceState('', '', window.location.pathname + window.location.search);
	}
	dispatch({
		type: UPDATE_HASH,
		hash
	});
};