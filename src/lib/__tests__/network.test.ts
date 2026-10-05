import { isNetworkFailure } from '../api';

describe('network failure detection (#103)', () => {
  it('recognises lost-signal errors from browsers and Amplify', () => {
    [
      'Network error',
      'TypeError: Failed to fetch',
      'Load failed',
      'NetworkError when attempting to fetch resource.',
    ].forEach(m => expect(isNetworkFailure(m)).toBe(true));
  });
  it('does not treat server answers as network failures', () => {
    expect(
      isNetworkFailure('VALIDATION: quantity: must be a whole number')
    ).toBe(false);
    expect(isNetworkFailure(undefined)).toBe(false);
  });
});
