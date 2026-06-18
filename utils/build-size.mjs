// Measures the size of the minified engine bundles — raw bytes plus gzip and brotli compressed sizes
// (gzip/brotli reflect real download cost). Both compressors are built into Node's zlib, so this has
// no dependencies. Run from the repo root after building the min bundles; emits JSON on stdout:
//   node utils/build-size.mjs > sizes.json
// Output shape: { "playcanvas.min.js": { raw, gzip, brotli }, "playcanvas.min.mjs": { ... } }

import { readFileSync } from 'node:fs';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

// the minified UMD and ESM bundles — the only artifacts this report tracks
const BUNDLES = ['build/playcanvas.min.js', 'build/playcanvas.min.mjs'];

const sizes = {};
for (const file of BUNDLES) {
    const buf = readFileSync(file);
    sizes[file.replace('build/', '')] = {
        raw: buf.length,
        gzip: gzipSync(buf, { level: 9 }).length,
        brotli: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length
    };
}

process.stdout.write(`${JSON.stringify(sizes, null, 2)}\n`);
