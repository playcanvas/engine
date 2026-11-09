import { Debug } from '../../../core/debug.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_R8, PIXELFORMAT_RG8 } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

// The precomputed lookup textures of SMAA, from the reference implementation:
// Copyright (C) 2013 Jorge Jimenez, Jose I. Echevarria, Belen Masia, Fernando Navarro, Diego
// Gutierrez, distributed under the MIT license (http://www.iryoku.com/smaa/).
//
// The area texture holds, for each shape of an aliased edge, the area its pixels cover. The
// reference texture is 160 x 560, seven subtextures of 160 x 80 for the subpixel offsets of the
// multisampled and temporal modes; SMAA 1x only reads the first, which is all this holds. The
// search texture decodes the edges fetched while searching for the end of an edge. Both are
// stored raw-deflate compressed, base64 encoded.

const AREA_WIDTH = 160;
const AREA_HEIGHT = 80;
const SEARCH_WIDTH = 64;
const SEARCH_HEIGHT = 16;

// 160 x 80, RG8
const areaData =
    '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' +
    'D/EBfjDRL/hBT7YWScgOQ8MObZlu5vUoP+GiiSxQaRVHozT/pAnFcMDqdQw0CPaws0g5XldO9c7/pLxUVxYr/3uogK+F8j/x8kGR' +
    '9bnpeIgf5n2JAbSTCx5ozVny3cJufs+OFvidN180dU0ZxpkQE7Cik7hBkJ1FyvG6cso536RcMBTrymLlfw8X8Eku/xMvHxRZn5vm' +
    'xuJB3p/wJj0pV8MPhL3ovh2S4/cTXGB7siq5ROWUSTUreCA6RUbMAeEcqRF0sm/uKydd6SZl5IM1ZbHyv18V8Eks/xMvHxRZn5vh' +
    'xuNBfigxmPAk+374gRBJ6Dys2yHZ/9BF0wG+TpTkC1RKxaGLJt2UYcIUYoLW2jky4HT3udk3zcrpJuU8OkcEZbHyv18X8Ekq/xMv' +
    'HxRZX2r/q12J/ZuIOYn9rzrQP0Io73ukQE9C+Z94+aDI+lLfAzqX2r/pWftfKUQK+BSS+D1aPiiyPtvp/k3P3f/qd7//K/IXuE73' +
    'b3rm/lft5v/E3u8Vf3+6w/2bnrv/VZv5P7H3ezvFT3L/pufuf9Vm/k/s/d5O8ZPcv+m5+1+1mf8Te7+3U/wk92967v5Xbeb/xN7v' +
    'FefXSv+mPfH+Tc/d/6rN/J/Y+70d4ye9f9Pz9r/qaP6v9QV+Q/+m5+1/1eH8X6sLdLx/03P3v+p4/q+1BX5D/6bn7X/1G/J/rSzQ' +
    '8f5Nz9//6jfk/6Qv8Bv6Nz13/6vfkv+TusBv6N/U2f5XT07gtZv/k7bAb+nf1Nn+V09O4LWb/5OygFQ7mvs37T3Wv6nz/a+enMBr' +
    'N/8nvsBv6d/U+f5X/7/8X8f4fYb32DV+LjtFP0V/90BV9XsM1wl2uv/V/wA=';

// 64 x 16, R8
const searchData =
    '+/ePob6egeEfhIKC+nowD0z9q4cJYQX/KNRPKfg3xN1PKUB2KlbBevzup1T/SHf/UAcA';

/**
 * The decoded lookup data, shared by all the SMAA effects, decoded on first use.
 *
 * @type {Promise<{ area: Uint8Array, search: Uint8Array }>|null}
 */
let lookupData = null;

/**
 * Decodes base64 encoded, raw-deflate compressed data.
 *
 * @param {string} base64 - The encoded data.
 * @param {number} size - The size of the decoded data, in bytes.
 * @returns {Promise<Uint8Array>} The decoded data.
 */
const decode = async (base64, size) => {
    const compressed = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const data = new Uint8Array(await new Response(stream).arrayBuffer());
    Debug.assert(data.length === size, `SMAA: the lookup data decoded to ${data.length} bytes instead of ${size}.`);
    return data;
};

/**
 * Returns the decoded lookup data, decoding it on the first call.
 *
 * @returns {Promise<{ area: Uint8Array, search: Uint8Array }>} The area and search texture data.
 * @ignore
 */
const getSmaaLookupData = () => {
    lookupData ??= Promise.all([
        decode(areaData, AREA_WIDTH * AREA_HEIGHT * 2),
        decode(searchData, SEARCH_WIDTH * SEARCH_HEIGHT)
    ]).then(([area, search]) => ({ area, search }));
    return lookupData;
};

/**
 * Creates the lookup textures of SMAA. They are created empty and filled once the lookup data is
 * decoded, which takes a frame or two the first time - until then, the textures giving no area to
 * any edge, SMAA leaves the scene unchanged.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @returns {{ area: Texture, search: Texture, ready: Promise<void> }} The textures, and a promise
 * resolved once they are filled - or left empty, when they were destroyed before, or the data could
 * not be decoded.
 * @ignore
 */
const createSmaaLookupTextures = (device) => {
    const create = (name, width, height, format) => new Texture(device, {
        name,
        width,
        height,
        format,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });

    const area = create('SmaaArea', AREA_WIDTH, AREA_HEIGHT, PIXELFORMAT_RG8);
    const search = create('SmaaSearch', SEARCH_WIDTH, SEARCH_HEIGHT, PIXELFORMAT_R8);

    const fill = (texture, data) => {
        if (texture.device) {
            texture.lock().set(data);
            texture.unlock();
        }
    };

    // On a browser without raw deflate decompression the textures stay empty, which leaves the scene
    // unchanged - the effect does nothing rather than failing.
    const ready = getSmaaLookupData().then((data) => {
        fill(area, data.area);
        fill(search, data.search);
    }, (error) => {
        Debug.warnOnce(`SMAA: the lookup data could not be decoded, so the effect leaves the scene unchanged - this browser does not support DecompressionStream with the 'deflate-raw' format. ${error}`);
    });

    return { area, search, ready };
};

export { createSmaaLookupTextures, getSmaaLookupData };
