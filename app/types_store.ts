import {
	SproutDataMap, SproutLocation
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
	sproutStreaming: boolean
}

export type RootState = {
	app: AppState;
	data: DataState;
};