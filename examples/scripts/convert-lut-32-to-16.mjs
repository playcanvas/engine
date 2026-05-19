/**
 * Convert a 32³ Unreal horizontal-strip LUT (1024×32) to 16³ (256×16) by
 * subsampling even indices on blue, red, and green (0, 2, 4, …, 30).
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const N32 = 32;
const N16 = 16;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = process.argv[2];
const destPath = process.argv[3];

if (!srcPath || !destPath) {
    console.error('Usage: node convert-lut-32-to-16.mjs <input.png> <output.png>');
    process.exit(1);
}

const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
if (width !== N32 * N32 || height !== N32) {
    throw new Error(`Expected ${N32 * N32}x${N32} strip, got ${width}x${height}`);
}

const outW = N16 * N16;
const outH = N16;
const out = Buffer.alloc(outW * outH * channels);

for (let b16 = 0; b16 < N16; b16++) {
    const b32 = b16 * 2;
    for (let g16 = 0; g16 < N16; g16++) {
        const g32 = g16 * 2;
        for (let r16 = 0; r16 < N16; r16++) {
            const r32 = r16 * 2;
            const inX = b32 * N32 + r32;
            const inY = g32;
            const outX = b16 * N16 + r16;
            const outY = g16;
            const inIdx = (inY * width + inX) * channels;
            const outIdx = (outY * outW + outX) * channels;
            for (let c = 0; c < channels; c++) {
                out[outIdx + c] = data[inIdx + c];
            }
        }
    }
}

await sharp(out, {
    raw: { width: outW, height: outH, channels }
})
.removeAlpha()
.png()
.toFile(destPath);

const meta = await sharp(destPath).metadata();
console.log(`Wrote ${destPath} (${meta.width}x${meta.height}) from ${width}x${height} (even-index subsample)`);
