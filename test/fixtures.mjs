import { createServer } from 'http';

import handler from 'serve-handler';

import { Http } from '../src/platform/net/http.js';

let server;

export const mochaGlobalSetup = () => {
    // Collapse the http retry tail so retries leaked by earlier tests (e.g. BundleHandler's
    // blob-URL loads that fail under JSDOM) drain in ~60 ms instead of ~6 s, preventing them
    // from polluting later tests that spy on http.request or swap global.XMLHttpRequest.
    Http.retryDelay = 1;

    server = createServer((request, response) => {
        return handler(request, response);
    });

    server.listen(3000, () => {
        console.log('Server started at http://localhost:3000');
    });
};

export const mochaGlobalTeardown = () => {
    server.close();
};
