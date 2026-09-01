import { expect } from 'chai';

import {
    BspHull,
    CONTENTS_EMPTY,
    CONTENTS_SOLID,
    findPlayerSpawn,
    parseBsp,
    parseEntities
} from '../../examples/src/examples/demos/quake/quake-bsp.mjs';
import {
    QuakeFileSystem,
    QuakeFormatError,
    QuakePak
} from '../../examples/src/examples/demos/quake/quake-pak.mjs';

/**
 * @param {Uint8Array} bytes - Destination.
 * @param {number} offset - Destination offset.
 * @param {string} value - ASCII value.
 */
const writeAscii = (bytes, offset, value) => {
    for (let i = 0; i < value.length; i++) {
        bytes[offset + i] = value.charCodeAt(i);
    }
};

/**
 * @param {Record<string, string>} files - Virtual archive contents.
 * @returns {Uint8Array} PAK bytes.
 */
const createPak = (files) => {
    const entries = Object.entries(files);
    const encoder = new TextEncoder();
    const payloads = entries.map(([, value]) => encoder.encode(value));
    const payloadLength = payloads.reduce((sum, payload) => sum + payload.length, 0);
    const directoryOffset = 12 + payloadLength;
    const bytes = new Uint8Array(directoryOffset + entries.length * 64);
    const view = new DataView(bytes.buffer);
    writeAscii(bytes, 0, 'PACK');
    view.setInt32(4, directoryOffset, true);
    view.setInt32(8, entries.length * 64, true);

    let payloadOffset = 12;
    entries.forEach(([name], index) => {
        bytes.set(payloads[index], payloadOffset);
        const entryOffset = directoryOffset + index * 64;
        writeAscii(bytes, entryOffset, name);
        view.setInt32(entryOffset + 56, payloadOffset, true);
        view.setInt32(entryOffset + 60, payloads[index].length, true);
        payloadOffset += payloads[index].length;
    });
    return bytes;
};

/**
 * @returns {Uint8Array} Minimal structurally valid BSP29 file.
 */
const createMinimalBsp = () => {
    const headerSize = 124;
    const entityBytes = new TextEncoder().encode('{\n"classname" "worldspawn"\n"message" "Unit Test"\n}\n\0');
    const textureBytes = new Uint8Array(4);
    const modelBytes = new Uint8Array(64);
    const modelView = new DataView(modelBytes.buffer);
    for (let i = 0; i < 4; i++) {
        modelView.setInt32(36 + i * 4, -1, true);
    }

    const lumpData = new Map([
        [0, entityBytes],
        [2, textureBytes],
        [14, modelBytes]
    ]);
    const totalLength = headerSize + entityBytes.length + textureBytes.length + modelBytes.length;
    const bytes = new Uint8Array(totalLength);
    const view = new DataView(bytes.buffer);
    view.setInt32(0, 29, true);
    let offset = headerSize;
    for (let lump = 0; lump < 15; lump++) {
        const data = lumpData.get(lump) ?? new Uint8Array(0);
        view.setInt32(4 + lump * 8, offset, true);
        view.setInt32(8 + lump * 8, data.length, true);
        bytes.set(data, offset);
        offset += data.length;
    }
    return bytes;
};

describe('Quake data support', function () {
    describe('QuakePak', function () {
        it('parses, normalizes and lists archive entries', function () {
            const pak = new QuakePak(createPak({
                'GFX/PALETTE.LMP': 'palette',
                'maps/E1M1.BSP': 'map'
            }));

            expect(new TextDecoder().decode(pak.get('gfx\\palette.lmp'))).to.equal('palette');
            expect(pak.list('maps/', '.bsp')).to.deep.equal(['maps/e1m1.bsp']);
            expect(pak.has('/MAPS/e1m1.bsp')).to.equal(true);
        });

        it('layers later archives over earlier archives', function () {
            const fileSystem = new QuakeFileSystem([
                new QuakePak(createPak({ 'maps/start.bsp': 'base' })),
                new QuakePak(createPak({ 'maps/start.bsp': 'override' }))
            ]);

            expect(new TextDecoder().decode(fileSystem.get('maps/start.bsp'))).to.equal('override');
            expect(fileSystem.list('maps/', '.bsp')).to.deep.equal(['maps/start.bsp']);
        });

        it('rejects files without a PACK signature', function () {
            expect(() => new QuakePak(new Uint8Array(12))).to.throw(QuakeFormatError, 'PACK signature');
        });
    });

    describe('BSP parsing', function () {
        it('parses a minimal BSP29 map', function () {
            const bsp = parseBsp(createMinimalBsp());

            expect(bsp.models).to.have.length(1);
            expect(bsp.textures).to.deep.equal([]);
            expect(bsp.entities[0]).to.deep.include({
                classname: 'worldspawn',
                message: 'Unit Test'
            });
        });

        it('rejects unsupported BSP versions', function () {
            const bytes = createMinimalBsp();
            new DataView(bytes.buffer).setInt32(0, 30, true);
            expect(() => parseBsp(bytes)).to.throw(QuakeFormatError, 'BSP version 30');
        });

        it('parses escaped entity values and selects the player spawn', function () {
            const entities = parseEntities([
                '{ "classname" "worldspawn" "message" "A\\nB" }',
                '{ "classname" "info_player_start" "origin" "10 20 30" "angle" "90" }'
            ].join('\n'));

            expect(entities[0].message).to.equal('A\nB');
            expect(findPlayerSpawn(entities)).to.deep.equal({ origin: [10, 20, 30], yaw: 90 });
        });
    });

    describe('BspHull', function () {
        const createHull = () => new BspHull(/** @type {any} */ ({
            planes: [{ normal: [1, 0, 0], distance: 0, type: 0 }],
            clipNodes: [{ planeIndex: 0, children: [CONTENTS_EMPTY, CONTENTS_SOLID] }],
            models: [{ headNodes: [0, 0, 0, 0] }]
        }));

        it('classifies points on either side of a clip plane', function () {
            const hull = createHull();
            expect(hull.pointContents([1, 0, 0])).to.equal(CONTENTS_EMPTY);
            expect(hull.pointContents([-1, 0, 0])).to.equal(CONTENTS_SOLID);
        });

        it('returns the first impact and collision normal', function () {
            const trace = createHull().trace([10, 0, 0], [-10, 0, 0]);

            expect(trace.startSolid).to.equal(false);
            expect(trace.allSolid).to.equal(false);
            expect(trace.fraction).to.be.closeTo(0.4984375, 0.000001);
            expect(trace.end[0]).to.be.closeTo(0.03125, 0.000001);
            expect(trace.normal).to.deep.equal([1, 0, 0]);
        });
    });
});
