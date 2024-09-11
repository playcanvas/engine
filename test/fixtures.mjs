import globalJsdom from 'global-jsdom';
import handler from 'serve-handler';
import http from 'http';
import XMLHttpRequest from 'xhr2';
import { Image } from 'skia-canvas';
let server;

export const mochaGlobalSetup = () => {
    globalJsdom(undefined, {
        resources: 'usable'
    });
    globalThis.Image = Image;

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
