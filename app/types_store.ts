import {
	SproutDataMap, SproutLocation
} from './types.js';

export type AppState = {
	page : string;
	pageExtra : string;
	offline : boolean;
	hash: string;
};

type ConverastionTurn = {
	speaker: 'user' | 'sprout',
	text: string
};

export type DataState = {
	openAIAPIKey : string,
	sprouts: SproutDataMap,
	currentSproutName: SproutLocation | null,
	sproutStreaming: boolean,
	conversation: ConverastionTurn[]
}

export type RootState = {
	app: AppState;
	data: DataState;
};