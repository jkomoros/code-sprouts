const OPENAI_API_KEY_LOCAL_STORAGE_KEY = 'OPENAI_API_KEY';

export const fetchOpenAIAPIKeyFromSTorage = () : string => {
	const str = window.localStorage.getItem(OPENAI_API_KEY_LOCAL_STORAGE_KEY);
	return str ? str : '';
};

export const storeOpenAIAPIKeyToSTorage = (apiKey : string) : void => {
	window.localStorage.setItem(OPENAI_API_KEY_LOCAL_STORAGE_KEY, apiKey);
};