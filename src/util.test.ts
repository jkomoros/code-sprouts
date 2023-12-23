import {
    completeAndParseJSON
} from './util';

describe('test completeAndParseJSON', () => {
  it('should not throw an error', () => {
    expect(() => completeAndParseJSON('')).not.toThrow();
  });
});