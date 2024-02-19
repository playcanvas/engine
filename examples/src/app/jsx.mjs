import { createElement, Fragment } from 'react';
export const jsx = createElement;
export const fragment = (/** @type {any} */ ...args) => jsx(Fragment, null, ...args);
