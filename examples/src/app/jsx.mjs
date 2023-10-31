import {createElement, Fragment} from 'react';
export const jsx = createElement;
export const fragment = (...args) => jsx(Fragment, null, ...args);
