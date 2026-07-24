import {
    TONEMAP_LINEAR, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_NEUTRAL
} from './constants.js';

/**
 * @import { Color } from '../core/math/color.js'
 */

// Uncharted 2 filmic curve, mirrors tonemappingFilmic shader chunk
const filmicCurve = (x) => {
    const A = 0.15, B = 0.50, C = 0.10, D = 0.20, E = 0.02, F = 0.30;
    return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
};

// Hill ACES fit, mirrors tonemappingAces2 shader chunk
const rrtAndOdtFit = (v) => {
    const a = v * (v + 0.0245786) - 0.000090537;
    const b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
};

/**
 * Applies exposure and tone mapping to the RGB channels of a linear-space color, mirroring the
 * engine's tone mapping shader chunks (the `toneMap` function selected by the TONEMAP define).
 * The alpha channel is left unchanged. Note that {@link TONEMAP_NONE} applies neither tone
 * mapping nor exposure, matching the shader behavior.
 *
 * @param {Color} color - The linear-space color to tone map. It is modified in place.
 * @param {number} toneMapping - The tone mapping transform to apply (TONEMAP_***).
 * @param {number} exposure - The exposure to apply.
 * @ignore
 */
function toneMapColor(color, toneMapping, exposure) {

    let { r, g, b } = color;

    switch (toneMapping) {

        case TONEMAP_LINEAR: {
            r *= exposure;
            g *= exposure;
            b *= exposure;
            break;
        }

        case TONEMAP_FILMIC: {
            const W = 11.2;
            const whiteScale = 1 / filmicCurve(W);
            r = filmicCurve(r * exposure) * whiteScale;
            g = filmicCurve(g * exposure) * whiteScale;
            b = filmicCurve(b * exposure) * whiteScale;
            break;
        }

        case TONEMAP_HEJL: {
            const A = 0.22, B = 0.3, C = 0.1, D = 0.2, E = 0.01, F = 0.3;
            const scl = 1.25;
            const hejl = (x) => {
                const h = Math.max(0, x * exposure - 0.004);
                return (h * ((scl * A) * h + scl * C * B) + scl * D * E) / (h * (A * h + B) + D * F) - scl * (E / F);
            };
            r = hejl(r);
            g = hejl(g);
            b = hejl(b);
            break;
        }

        case TONEMAP_ACES: {
            const tA = 2.51, tB = 0.03, tC = 2.43, tD = 0.59, tE = 0.14;
            const aces = (v) => {
                const x = v * exposure;
                return (x * (tA * x + tB)) / (x * (tC * x + tD) + tE);
            };
            r = aces(r);
            g = aces(g);
            b = aces(b);
            break;
        }

        case TONEMAP_ACES2: {
            const scale = exposure / 0.6;
            r *= scale;
            g *= scale;
            b *= scale;

            // sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
            let ir = 0.59719 * r + 0.35458 * g + 0.04823 * b;
            let ig = 0.07600 * r + 0.90834 * g + 0.01566 * b;
            let ib = 0.02840 * r + 0.13383 * g + 0.83777 * b;

            ir = rrtAndOdtFit(ir);
            ig = rrtAndOdtFit(ig);
            ib = rrtAndOdtFit(ib);

            // ODT_SAT => XYZ => D60_2_D65 => sRGB
            r = 1.60475 * ir - 0.53108 * ig - 0.07367 * ib;
            g = -0.10208 * ir + 1.10813 * ig - 0.00605 * ib;
            b = -0.00327 * ir - 0.07276 * ig + 1.07602 * ib;

            r = Math.min(Math.max(r, 0), 1);
            g = Math.min(Math.max(g, 0), 1);
            b = Math.min(Math.max(b, 0), 1);
            break;
        }

        case TONEMAP_NEUTRAL: {
            r *= exposure;
            g *= exposure;
            b *= exposure;

            const startCompression = 0.8 - 0.04;
            const desaturation = 0.15;

            const x = Math.min(r, Math.min(g, b));
            const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
            r -= offset;
            g -= offset;
            b -= offset;

            const peak = Math.max(r, Math.max(g, b));
            if (peak >= startCompression) {
                const d = 1 - startCompression;
                const newPeak = 1 - (d * d) / (peak + d - startCompression);
                const peakScale = newPeak / peak;
                r *= peakScale;
                g *= peakScale;
                b *= peakScale;

                const t = 1 - 1 / (desaturation * (peak - newPeak) + 1);
                r += (newPeak - r) * t;
                g += (newPeak - g) * t;
                b += (newPeak - b) * t;
            }
            break;
        }
    }

    color.r = r;
    color.g = g;
    color.b = b;
}

export { toneMapColor };
