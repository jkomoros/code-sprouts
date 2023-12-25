import {
	StreamingJSONParser
} from './streaming-json';

const parseStreamingJSON = (partialJSON : string) : unknown => {
	const parser = new StreamingJSONParser();
	parser.ingest(partialJSON);
	return parser.json();
};

describe('test parseStreamingJSON', () => {
	it('should not throw an error', () => {
		const input = '';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('should not throw for starter object', () => {
		const input = '{';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that starts a key', () => {
		const input = '{"';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that starts a key with an item', () => {
		const input = '{"a';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that has a complete key', () => {
		const input = '{"a"';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that is inside an object', () => {
		const input = '{"a":{';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that is inside an array', () => {
		const input = '{"a":[';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that is inside an array object', () => {
		const input = '{"a":[{';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that is inside an array object string', () => {
		const input = '{"a":[{"';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('should not throw for realistic partial object', () => {
		const input = '{\n"userMessage":';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('should not throw for realistic partial object with trailing comma', () => {
		const input = '{\n"userMessage": "a",';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('should not throw for realistic partial object with trailing comma and start key', () => {
		const input = '{\n"userMessage": "a",\n"';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('handles escaped strings right', () => {
		const input = '{\n"userMessage": "a \\"b",\n"';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('handles ending on escaped character right', () => {
		const input = '{\n"userMessage": "a \\';
		expect(() => parseStreamingJSON(input)).not.toThrow();
	});

	it('iteratively handles a long and complex bit of json', () => {
		const input = `{
			"userMessage": "This is a great thing",
			"patch": [
				{
					"op": "add",
					"path": "/blammo",
					"value": 3
				}
			]
		}`;
		for (let i = 0; i < input.length; i++) {
			const str = input.slice(0,i);
			expect(() => parseStreamingJSON(str)).not.toThrow();
		}
	});

	it('iteratively handles a long and complex bit of json number 2', () => {
		const input = `{
			"userMessage": "a",
			"patch": [
				{
					"op": "add",
					"path": "/responses/-",
					"value": "a"
				}
			]
		}`;
		for (let i = 0; i < input.length; i++) {
			const str = input.slice(0,i);
			expect(() => parseStreamingJSON(str)).not.toThrow();
		}
	});

	it('iteratively handles a long and complex bit of json number 3 including colon and comma', () => {
		const input = `{
			"userMessage": "This is a value: and another one,",
			"patch": [
				{
					"op": "add",
					"path": "/responses/-",
					"value": "a"
				},
				{
					"op:": "add",
					"path": "/responses/-",
					"value": "b"
				}
			]
		}`;
			
		for (let i = 0; i < input.length; i++) {
			const str = input.slice(0,i);
			expect(() => parseStreamingJSON(str)).not.toThrow();
		}
	});

});