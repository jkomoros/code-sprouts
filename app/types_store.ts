export type AppState = {
	page : string;
	pageExtra : string;
	offline : boolean;
	hash: string;
};

export type DataState = {
    openAIAPIKey : string
}

export type RootState = {
	app: AppState;
	data: DataState;
};