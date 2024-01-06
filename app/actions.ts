import {
	z
} from 'zod';

import {
	sproutDataMapSchema,
	sproutLocationSchema
} from './types.js';

import {
	imageURLSchema,
	modelProvider,
	packagedSproutSchema,
	promptSchema,
	sproutNameSchema,
	sproutStateSchema,
	uncompiledPackagedSproutSchema
} from '../src/types.js';

export const UPDATE_PAGE = 'UPDATE_PAGE';
export const UPDATE_OFFLINE = 'UPDATE_OFFLINE';
export const UPDATE_HASH = 'UPDATE_HASH';
export const UPDATE_MOBILE = 'UPDATE_MOBILE';

export const ADD_SPROUTS = 'ADD_SPROUTS';
export const SELECT_SPROUT = 'SELECT_SPROUT';
export const SET_API_KEY = 'SET_API_KEY';
export const START_STREAMING_SPROUT = 'START_STREAMING_SPROUT';
export const STREAM_INCREMENTAL_MESSAGE = 'STREAM_INCREMENTAL_MESSAGE';
export const SPROUT_PROVIDED_USER_RESPONSE = 'SPROUT_PROVIDED_USER_RESPONSE';
export const SPROUT_STOPPED_STREAMING = 'SPROUT_STOPPED_STREAMING';
export const UPDATE_DRAFT_MESSAGE = 'UPDATE_DRAFT_MESSAGE';
export const ATTACH_IMAGE = 'ATTACH_IMAGE';
export const OPEN_EDITOR = 'OPEN_EDITOR';
export const CLOSE_EDITOR = 'CLOSE_EDITOR';
export const START_EDITING = 'START_EDITING';
export const EDITING_MODIFY_SPROUT = 'EDITING_MODIFY_SPROUT';
export const WRITE_SPROUT = 'WRITE_SPROUT';
export const FORCE_OPEN_API_KEYS_DIALOG = 'FORCE_OPEN_API_KEYS_DIALOG';
//This is actually poorly named, because it doesn't force the editor to close,
//it just lowers the forcedOpen flag.
export const FORCE_CLOSE_API_KEYS_DIALOG = 'FORCE_CLOSE_API_KEYS_DIALOG';

const actionUpdatePage = z.object({
	type: z.literal(UPDATE_PAGE),
	page: z.string(),
	pageExtra: z.string()
}).strict();

const actionUpdateOffline = z.object({
	type: z.literal(UPDATE_OFFLINE),
	offline: z.boolean()
}).strict();

export type ActionUpdateOffline = z.infer<typeof actionUpdateOffline>;

const actionUpdateHash = z.object({
	type: z.literal(UPDATE_HASH),
	hash: z.string()
}).strict();

const actionUpdateMobile = z.object({
	type: z.literal(UPDATE_MOBILE),
	mobile: z.boolean()
});

const actionAddSprouts = z.object({
	type: z.literal(ADD_SPROUTS),
	sprouts: sproutDataMapSchema,
}).strict();

const actionSelectSprout = z.object({
	type: z.literal(SELECT_SPROUT),
	sprout: sproutLocationSchema
}).strict();

const actionSetAPIKey = z.object({
	type: z.literal(SET_API_KEY),
	provider: modelProvider,
	key: z.string()
}).strict();

const actionStartStreamingSprout = z.object({
	type: z.literal(START_STREAMING_SPROUT)
}).strict();

const actionStreamIncrementalMessage = z.object({
	type: z.literal(STREAM_INCREMENTAL_MESSAGE)
}).strict();

const actionSproutStoppedStreaming = z.object({
	type: z.literal(SPROUT_STOPPED_STREAMING),
	state: sproutStateSchema
}).strict();

const actionSproutProvidedUserResponse = z.object({
	type: z.literal(SPROUT_PROVIDED_USER_RESPONSE),
	response: promptSchema
}).strict();

const actionUpdateDraftMessage = z.object({
	type: z.literal(UPDATE_DRAFT_MESSAGE),
	message: z.string()
}).strict();

const actionAttachImage = z.object({
	type: z.literal(ATTACH_IMAGE),
	image: z.union([imageURLSchema, z.literal(null)])
}).strict();

const actionOpenEditor = z.object({
	type: z.literal(OPEN_EDITOR),
	snapshot: uncompiledPackagedSproutSchema
}).strict();

const actionCloseEditor = z.object({
	type: z.literal(CLOSE_EDITOR),
}).strict();

const actionStartEditing = z.object({
	type: z.literal(START_EDITING),
}).strict();

const actionEditingModifySprout = z.object({
	type: z.literal(EDITING_MODIFY_SPROUT),
	snapshot: uncompiledPackagedSproutSchema,
}).strict();

const actionWriteSprout = z.object({
	type: z.literal(WRITE_SPROUT),
	name: sproutNameSchema,
	sprout: packagedSproutSchema
}).strict();

const actionForceOpenAPIKeysDialog = z.object({
	type: z.literal(FORCE_OPEN_API_KEYS_DIALOG)
}).strict();

const actionForceCloseAPIKeysDialog = z.object({
	type: z.literal(FORCE_CLOSE_API_KEYS_DIALOG)
}).strict();

const someAction = z.discriminatedUnion('type', [
	actionUpdatePage,
	actionUpdateOffline,
	actionUpdateHash,
	actionUpdateMobile,
	actionAddSprouts,
	actionSelectSprout,
	actionSetAPIKey,
	actionStartStreamingSprout,
	actionStreamIncrementalMessage,
	actionSproutStoppedStreaming,
	actionSproutProvidedUserResponse,
	actionUpdateDraftMessage,
	actionAttachImage,
	actionOpenEditor,
	actionCloseEditor,
	actionStartEditing,
	actionEditingModifySprout,
	actionWriteSprout,
	actionForceCloseAPIKeysDialog,
	actionForceOpenAPIKeysDialog
]);

export type SomeAction = z.infer<typeof someAction>;