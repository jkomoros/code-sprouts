import {
	z
} from 'zod';
import { sproutDataMapSchema } from './types';

export const UPDATE_PAGE = 'UPDATE_PAGE';
export const UPDATE_OFFLINE = 'UPDATE_OFFLINE';
export const UPDATE_HASH = 'UPDATE_HASH';

export const ADD_SPROUTS = 'ADD_SPROUTS';
export const SET_OPENAI_API_KEY = 'SET_OPENAI_API_KEY';

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

const actionAddSprouts = z.object({
	type: z.literal(ADD_SPROUTS),
	sprouts: sproutDataMapSchema,
}).strict();

const actionSetOpenAPIKey = z.object({
	type: z.literal(SET_OPENAI_API_KEY),
	key: z.string()
}).strict();

const someAction = z.discriminatedUnion('type', [
	actionUpdatePage,
	actionUpdateOffline,
	actionUpdateHash,
	actionAddSprouts,
	actionSetOpenAPIKey
]);

export type SomeAction = z.infer<typeof someAction>;