const OPENAI_API_KEY_LOCAL_STORAGE_KEY = 'OPENAI_API_KEY';

export const fetchOpenAIAPIKeyFromStorage = () : string => {
	const str = window.localStorage.getItem(OPENAI_API_KEY_LOCAL_STORAGE_KEY);
	return str ? str : '';
};

export const storeOpenAIAPIKeyToStorage = (apiKey : string) : void => {
	window.localStorage.setItem(OPENAI_API_KEY_LOCAL_STORAGE_KEY, apiKey);
};