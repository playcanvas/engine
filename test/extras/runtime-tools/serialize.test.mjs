import { expect } from 'chai';

import { serialize, tryCatch } from '../../../src/extras/runtime-tools/serialize.js';

describe('serialize', function () {

    it('marks cycles without throwing', function () {
        const a = { name: 'a' };
        a.self = a;
        expect(serialize(a)).to.deep.equal({ name: 'a', self: '[circular]' });
    });

    it('serializes shared (non-cyclic) refs fully both times', function () {
        const shared = { hp: 10 };
        expect(serialize({ x: shared, y: shared })).to.deep.equal({ x: { hp: 10 }, y: { hp: 10 } });
    });

    it('caps recursion depth', function () {
        expect(serialize({ a: { b: { c: {} } } }, { depth: 1 }).a).to.equal('[Object]');
    });

    it('reduces vectors and colors to rounded arrays', function () {
        expect(serialize({ x: 1.23456, y: 2, z: -0 })).to.deep.equal([1.235, 2, 0]);
        expect(serialize({ r: 1, g: 0.5, b: 0, a: 1 })).to.deep.equal([1, 0.5, 0, 1]);
    });

    it('caps arrays and typed arrays', function () {
        expect(serialize(new Float32Array([1, 2, 3]), { maxItems: 2 })).to.deep.equal([1, 2, '+1 more']);
    });

    it('summarizes graph nodes with orientation instead of walking the tree', function () {
        const player = {
            name: 'player',
            enabled: true,
            parent: null,
            children: [{}, {}],
            c: { render: {}, script: {} },
            getPosition: () => ({ x: 1, y: 0, z: 2 }),
            get forward() {
                return { x: 0, y: 0, z: -1 };
            }
        };
        const s = serialize(player);
        expect(s.name).to.equal('player');
        expect(s.position).to.deep.equal([1, 0, 2]);
        expect(s.forward).to.deep.equal([0, 0, -1]);
        expect(s.children).to.equal(2);
        expect(s.components).to.deep.equal(['render', 'script']);
    });

    it('contains throwing getters and keeps siblings', function () {
        const bad = {
            ok: 1,
            get boom() {
                throw new Error('nope');
            }
        };
        const s = serialize(bad);
        expect(s.ok).to.equal(1);
        expect(s.boom).to.match(/getter error: nope/);
    });

    it('truncates long strings', function () {
        expect(serialize('x'.repeat(10), { maxString: 4 })).to.equal('xxxx…');
    });

    it('returns { error } when serialization throws', function () {
        // a proxy whose ownKeys trap throws forces walk() to throw, exercising the top-level guard
        const evil = new Proxy({}, {
            ownKeys() {
                throw new Error('boom');
            }
        });
        expect(serialize(evil).error).to.match(/boom/);
    });

    it('tryCatch returns a [error, result] tuple', function () {
        expect(tryCatch(() => 5)).to.deep.equal([null, 5]);
        const [err, res] = tryCatch(() => {
            throw new Error('x');
        });
        expect(err).to.be.instanceOf(Error);
        expect(res).to.be.undefined;
    });
});
