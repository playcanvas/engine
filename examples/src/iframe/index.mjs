import 'regenerator-runtime/runtime.js';
import 'url-search-params-polyfill/index.js';
import 'promise-polyfill/dist/polyfill.min.js';
import 'whatwg-fetch/dist/fetch.umd.js';
import '../../lib/arrayFromPolyfill.js';
import '../../lib/objectValuesPolyfill.js';
import * as observer from '@playcanvas/observer';
import * as pcui from '@playcanvas/pcui/react';
import React from 'react';
import 'pc-alias';
import * as pcx from '../../../build/playcanvas-extras.mjs/index.js';

window.observer = observer;
window.pcui = window.top.pcui || pcui;
window.React = window.top.React || React;
window.pcx = pcx;
