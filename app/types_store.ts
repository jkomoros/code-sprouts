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
	currentSprout: SproutLocation | null,
}

export type RootState = {
	app: AppState;
	data: DataState;
};