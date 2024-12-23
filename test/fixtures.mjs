import { createServer } from 'http';

import handler from 'serve-handler';

let server;

export const mochaGlobalSetup = () => {
    server = createServer((request, response) => {
        return handler(request, response);
    });

    server.listen(3000, () => {
        console.log('Server started at http://localhost:3000');
    });
};

export const mochaGlobalTeardown = async () => {
    if (server) {
        await new Promise(resolve => server.close(resolve));
        server = null;
    }
};
