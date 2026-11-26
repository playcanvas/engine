import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

import handler from 'serve-handler';

const PORT = 51000;
const PUBLIC_DIR = fileURLToPath(new URL('../build', import.meta.url));

const server = createServer((request, response) => {
    // Let pages on other origins, including public sites loading a local engine build, fetch from
    // this server. Private-Network covers Chrome's preflight for public-to-localhost requests.
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', '*');
    response.setHeader('Access-Control-Allow-Private-Network', 'true');

    handler(request, response, { public: PUBLIC_DIR, etag: true }).catch((err) => {
        console.error(err);
        if (!response.headersSent) {
            response.statusCode = 500;
        }
        response.end();
    });
});

server.listen(PORT, () => {
    console.log(`Serving ${PUBLIC_DIR} at http://localhost:${PORT}`);
});
