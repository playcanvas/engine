import fs from 'node:fs';
import { parseArgs } from 'node:util';

import { buildProd } from './utils/build-prod.mjs';
import { generateCertificates } from './utils/certificates.mjs';
import { buildMetadata } from './utils/metadata.mjs';
import { buildThumbnails } from './utils/thumbnails.mjs';

const USAGE = `Usage: node build.mjs [options]

Options:
  --cert          Generate local HTTPS dev certificates
  --metadata      Generate cache/metadata.mjs
  --thumbnails    Generate thumbnails
  --clean         Remove dist and cache
  --debug         Enable thumbnail debug logging
  --help, -h      Show help`;

const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
        cert: { type: 'boolean' },
        metadata: { type: 'boolean' },
        thumbnails: { type: 'boolean' },
        clean: { type: 'boolean' },
        debug: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
});

/**
 * @returns {Promise<void>} completion promise.
 */
const clean = async () => {
    await Promise.all([
        fs.promises.rm('dist', { recursive: true, force: true }),
        fs.promises.rm('cache', { recursive: true, force: true })
    ]);
};

/**
 * @returns {Promise<void>} completion promise.
 */
const main = async () => {
    if (values.help) {
        console.log(USAGE);
        return;
    }

    if (values.cert) {
        process.exitCode = generateCertificates(positionals) ? 0 : 1;
        return;
    }

    if (positionals.length) {
        console.error(USAGE);
        process.exitCode = 1;
        return;
    }

    if (values.metadata) {
        await buildMetadata();
        return;
    }

    if (values.thumbnails) {
        await buildMetadata();
        await buildThumbnails({
            clean: values.clean,
            debug: values.debug
        });
        return;
    }

    if (values.clean) {
        await clean();
        return;
    }

    await buildMetadata();
    await buildProd();
};

await main();
