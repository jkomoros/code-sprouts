import {
	ImageURL
} from '../src/types.js';

import {
	SproutDataMap,
	SproutLocation,
} from './types.js';

export type AppState = {
	page : string;
	pageExtra : string;
	offline : boolean;
	hash: string;
};

export type DataState = {
	openAIAPIKey : string,
	sprouts: SproutDataMap,
	currentSproutName: SproutLocation | null,
	sproutStreaming: boolean,
	//The conversation is managed by the currentSprout, but we need to tell the
	//selector machinery once we have reason to believe its state has changed.
	streamCounter: number,
	draftMessage: string
	attachedImage: ImageURL | null
}

export type RootState = {
	app: AppState;
	data: DataState;
};