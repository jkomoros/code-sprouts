import {
	completeAndParseJSON
} from './util';

describe('test completeAndParseJSON', () => {
	it('should not throw an error', () => {
		const input = '';
		expect(() => completeAndParseJSON(input)).not.toThrow();
	});

	it('should not throw for starter object', () => {
		const input = '{';
		expect(() => completeAndParseJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that starts a key', () => {
		const input = '{"';
		expect(() => completeAndParseJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that starts a key with an item', () => {
		const input = '{"a';
		expect(() => completeAndParseJSON(input)).not.toThrow();
	});

	it('should not throw for starter object that has a complete key', () => {
		const input = '{"a"';
		expect(() => completeAndParseJSON(input)).not.toThrow();
	});

});