import fs from 'node:fs';
import { parseArgs } from 'node:util';

import { buildProd } from './utils/build-prod.mjs';
import { buildMetadata } from './utils/metadata.mjs';
import { buildThumbnails } from './utils/thumbnails.mjs';

const USAGE = `Usage: node build.mjs [options]

Options:
  --metadata      Generate cache/metadata.mjs
  --thumbnails    Generate thumbnails
  --clean         Remove dist and cache
  --debug         Enable thumbnail debug logging
  --help, -h      Show help`;

const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
        metadata: { type: 'boolean' },
        thumbnails: { type: 'boolean' },
        clean: { type: 'boolean' },
        debug: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: false
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
