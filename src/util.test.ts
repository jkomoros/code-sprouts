import {
	parsePartialJSON
} from './util';

describe('test parsePartialJSON', () => {
	it('should not throw an error', () => {
		const input = '';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('should not throw for starter object', () => {
		const input = '{';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that starts a key', () => {
		const input = '{"';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that starts a key with an item', () => {
		const input = '{"a';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that has a complete key', () => {
		const input = '{"a"';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that is inside an object', () => {
		const input = '{"a":{';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that is inside an array', () => {
		const input = '{"a":[';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that is inside an array object', () => {
		const input = '{"a":[{';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that is inside an array object string', () => {
		const input = '{"a":[{"';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('should not throw for realistic partial object', () => {
		const input = '{\n"userMessage":';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('should not throw for realistic partial object with trailing comma', () => {
		const input = '{\n"userMessage": "a",';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('should not throw for realistic partial object with trailing comma and start key', () => {
		const input = '{\n"userMessage": "a",\n"';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('handles escaped strings right', () => {
		const input = '{\n"userMessage": "a \\"b",\n"';
		expect(() => parsePartialJSON(input)).not.toThrow();
	});

	it('handles ending on escaped character right', () => {
		const input = '{\n"userMessage": "a \\';
		expect(() => parsePartialJSON(input)).not.toThrow();
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
			expect(() => parsePartialJSON(str)).not.toThrow();
		}
	});

});