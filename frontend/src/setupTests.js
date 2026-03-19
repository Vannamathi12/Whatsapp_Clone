import '@testing-library/jest-dom';

const originalConsoleError = console.error;

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    const firstArg = typeof args[0] === 'string' ? args[0] : '';

    if (firstArg.includes('ReactDOMTestUtils.act is deprecated in favor of React.act')) {
      return;
    }

    originalConsoleError(...args);
  });
});

afterAll(() => {
  if (console.error.mockRestore) {
    console.error.mockRestore();
  }
});
