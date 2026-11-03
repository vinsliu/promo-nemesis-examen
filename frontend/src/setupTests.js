// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// React Router 7 uses browser encoding APIs missing from Jest’s jsdom environment.
const { TextEncoder, TextDecoder } = require('node:util');
Object.assign(globalThis, { TextEncoder, TextDecoder });
