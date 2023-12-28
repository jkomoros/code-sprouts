import {
	SproutDataMap,
	SproutLocation,
	Conversation
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
	conversation: Conversation,
	draftMessage: string
}

export type RootState = {
	app: AppState;
	data: DataState;
};