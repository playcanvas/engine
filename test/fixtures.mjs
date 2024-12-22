import handler from 'serve-handler';
import http from 'http';

let server;

export const mochaGlobalSetup = () => {
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
