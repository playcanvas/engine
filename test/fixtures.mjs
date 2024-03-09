import handler from 'serve-handler';
import http from 'http';
import XMLHttpRequest from 'xhr2';

import 'global-jsdom/register'; // eslint-disable-line import/no-unresolved,import/extensions

let server;

export const mochaGlobalSetup = () => {
    // Provide a polyfill for XMLHttpRequest required by the engine
    global.XMLHttpRequest = XMLHttpRequest;

    server = http.createServer((request, response) => {
        return handler(request, response);
    });

    server.listen(3000, () => {
        console.log('Server started at http://localhost:3000');
    });
};

export const mochaGlobalTeardown = () => {
    server.close();
};
