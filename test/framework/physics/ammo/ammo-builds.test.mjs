import { readFileSync } from 'node:fs';

import { expect } from 'chai';

import { AMMO_WASM_BINARY_PATH, hasAmmo, hasAmmoWasm, loadAmmo, loadAmmoWasm } from '../../../ammo.mjs';

const MB = 1024 * 1024;
const WASM_PAGE = 65536;

/**
 * Reads the limits of the first memory in a wasm binary's memory section.
 *
 * @param {Buffer} binary - The wasm binary.
 * @returns {{ initial: number, maximum: number|null }} The limits in pages, maximum null when
 * the memory is unbounded.
 */
function readMemoryLimits(binary) {
    let offset = 8; // magic + version

    const leb = () => {
        let result = 0;
        let shift = 0;
        let byte;
        do {
            byte = binary[offset++];
            result |= (byte & 0x7f) << shift;
            shift += 7;
        } while (byte & 0x80);
        return result >>> 0;
    };

    while (offset < binary.length) {
        const id = binary[offset++];
        const size = leb();
        const end = offset + size;
        if (id === 5) {
            leb(); // memory count
            const flags = leb();
            const initial = leb();
            const maximum = (flags & 1) ? leb() : null;
            return { initial, maximum };
        }
        offset = end;
    }

    throw new Error('no memory section');
}

/**
 * Asserts the heap facts the shipped builds are configured for: a 16MB start, growth on demand,
 * and a working simulation on top.
 *
 * @param {object} Ammo - An initialized Ammo module.
 */
function expectGrowableHeap(Ammo) {
    const initial = Ammo.HEAP8.byteLength;
    expect(initial).to.equal(16 * MB);

    const pointer = Ammo._malloc(32 * MB);
    expect(pointer).to.not.equal(0);
    expect(Ammo.HEAP8.byteLength).to.be.above(initial);
    expect(Ammo.HEAP8.byteLength).to.be.at.least(pointer + 32 * MB);

    // a glue and binary that do not belong together fail here, not in a physics suite
    const configuration = new Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(configuration);
    const broadphase = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();
    const world = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, configuration);
    world.stepSimulation(1 / 60, 1, 1 / 60);
    Ammo.destroy(world);
    Ammo.destroy(solver);
    Ammo.destroy(broadphase);
    Ammo.destroy(dispatcher);
    Ammo.destroy(configuration);
}

// Smoke tests for the Ammo builds shipped in examples/assets/wasm/ammo. The physics suites only
// ever load the asm.js fallback, so these are what ties the wasm glue and binary together and pins
// the heap configuration of both builds.
describe('Ammo builds', function () {

    it('the wasm binary declares a 16MB initial heap that can grow', function () {
        if (!hasAmmoWasm()) {
            this.skip();
        }

        const { initial, maximum } = readMemoryLimits(readFileSync(AMMO_WASM_BINARY_PATH));

        expect(initial * WASM_PAGE).to.equal(16 * MB);
        expect(maximum === null || maximum > initial, 'growable').to.be.true;
    });

    it('the wasm glue instantiates its binary and grows the heap on demand', async function () {
        if (!hasAmmoWasm()) {
            this.skip();
        }
        this.timeout(20000);

        expectGrowableHeap(await loadAmmoWasm());
    });

    it('the asm.js fallback starts at 16MB and grows the heap on demand', async function () {
        if (!hasAmmo()) {
            this.skip();
        }
        this.timeout(20000);

        expectGrowableHeap(await loadAmmo());
    });
});
