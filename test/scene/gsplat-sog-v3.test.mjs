import { expect } from 'chai';

import { Quat } from '../../src/core/math/quat.js';
import { Vec3 } from '../../src/core/math/vec3.js';
import { Vec4 } from '../../src/core/math/vec4.js';
import { blindAccessors, blindFields, decodeBlindField } from '../../src/scene/gsplat/gsplat-sog-blind.js';
import { GSplatSogData } from '../../src/scene/gsplat/gsplat-sog-data.js';
import { GSplatSogResource } from '../../src/scene/gsplat/gsplat-sog-resource.js';
import { GSplatOctreeResource } from '../../src/scene/gsplat-unified/gsplat-octree.resource.js';

// A fake RGBA8 texture whose CPU-side level the iterator reads.
const tex = (rgba, width = rgba.length / 4) => ({ _levels: [Uint8Array.from(rgba)], width, height: 1 });

// The writer's mid-tread exp-map encode (splat-transform src/lib/utils/quat-expmap.ts).
const encodeExpMap = (w, x, y, z) => {
    const s = w < 0 ? -1 : 1;
    [w, x, y, z] = [w * s, x * s, y * s, z * s];
    const sv = Math.hypot(x, y, z);
    const k = sv > 1e-12 ? Math.atan2(sv, w) / sv / (Math.PI / 2) : 2 / Math.PI;
    return [x, y, z].map(v => Math.max(0, Math.min(255, Math.round(v * k * 127 + 128))));
};

const meta = (extra = {}) => ({
    version: 3,
    count: 1,
    means: { mins: [0, 0, 0], maxs: [1, 1, 1] },
    scales: { codebook: Array.from({ length: 256 }, (_, i) => i / 255) },
    sh0: { codebook: Array.from({ length: 256 }, (_, i) => i / 255 - 0.5) },
    opacity: { max: 1.6 },
    ...extra
});

// Build one-gaussian v3 data with the given rotation bytes and sh0 alpha index.
const makeData = (rot, alphaIndex = 0, extraMeta = {}) => {
    const data = new GSplatSogData();
    data.meta = meta(extraMeta);
    data.numSplats = 1;
    data.means_l = tex([0, 0, 0, rot[0]]);
    data.means_u = tex([0, 0, 0, rot[1]]);
    data.scales = tex([0, 0, 0, rot[2]]);
    data.sh0 = tex([128, 128, 128, alphaIndex]);
    data.quats = null;
    return data;
};

describe('GSplatSogData v3', function () {
    it('recognizes the 4-band palette width', function () {
        expect(GSplatSogData.calcBands(1536)).to.equal(4);
        expect(GSplatSogData.calcBands(960)).to.equal(3);
    });

    it('decodes the identity rotation exactly', function () {
        const r = new Quat();
        makeData([128, 128, 128]).createIter(null, r).read(0);
        expect([r.x, r.y, r.z, r.w]).to.deep.equal([0, 0, 0, 1]);
    });

    it('decodes exp-map rotations within quantization error', function () {
        const cases = [
            new Quat().setFromEulerAngles(0, 0, 90),
            new Quat().setFromEulerAngles(30, -60, 10),
            new Quat().setFromEulerAngles(170, 5, -120),
            new Quat().setFromEulerAngles(-89, 45, 179)
        ];
        for (const q of cases) {
            const r = new Quat();
            makeData(encodeExpMap(q.w, q.x, q.y, q.z)).createIter(null, r).read(0);
            const dot = Math.abs(q.x * r.x + q.y * r.y + q.z * r.z + q.w * r.w);
            const degrees = 2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI;
            expect(degrees).to.be.below(1.25);
            expect(Math.hypot(r.x, r.y, r.z, r.w)).to.be.closeTo(1, 1e-6);
        }
    });

    it('decodes the opacity byte as (b / 204)^2, exact at 0 and 1, up to 1.5625', function () {
        const c = new Vec4();
        const read = (b) => {
            makeData([128, 128, 128], b).createIter(null, null, null, c).read(0);
            return c.w;
        };
        expect(read(0)).to.equal(0);
        expect(read(102)).to.be.closeTo(0.25, 1e-12);
        expect(read(204)).to.equal(1);
        expect(read(255)).to.be.closeTo(1.5625, 1e-12);
        expect(read(230)).to.be.closeTo((230 / 204) ** 2, 1e-12);
    });

    it('reads 24 coefficients per channel for 4 bands', function () {
        const data = makeData([128, 128, 128], 0, {
            shN: { count: 1, bands: 4, codebook: Array.from({ length: 256 }, (_, i) => i) }
        });
        data.shBands = 4;
        data.sh_labels = tex([0, 0, 0, 255]);
        // palette entry 0: coefficient k of channel j is index j * 24 + k
        const centroids = [];
        for (let k = 0; k < 24; k++) centroids.push(k, 24 + k, 48 + k, 255);
        data.sh_centroids = tex(centroids, 64 * 24);
        const sh = new Float32Array(72);
        data.createIter(null, null, null, null, sh).read(0);
        expect(Array.from(sh)).to.deep.equal(Array.from({ length: 72 }, (_, i) => i));
    });

    it('keeps v2 rotations on the smallest-three path', function () {
        const data = makeData([0, 0, 0]);
        data.meta.version = 2;
        // mode 0 (w omitted), components 0 -> identity
        data.quats = tex([128, 128, 128, 252]);
        const r = new Quat();
        data.createIter(new Vec3(), r).read(0);
        expect(r.w).to.be.closeTo(1, 1e-3);
    });

    it('exposes extras from meta.json and lod-meta.json', function () {
        const extras = { scene: 'a', ids: [1, 2] };
        const sog = Object.assign(Object.create(GSplatSogResource.prototype), { gsplatData: { meta: { version: 3, extras } } });
        expect(sog.extras).to.equal(extras);
        const lod = Object.assign(Object.create(GSplatOctreeResource.prototype), { data: { extras } });
        expect(lod.extras).to.equal(extras);
        const none = Object.assign(Object.create(GSplatSogResource.prototype), { gsplatData: { meta: { version: 2 } } });
        expect(none.extras).to.equal(undefined);
    });
});

describe('SOG v3 blind data', function () {
    const blindMeta = {
        blind: [
            { files: ['blind_0.webp'], fields: [{ name: 'weight', type: 'f16', offset: 0 }, { name: 'seg-id', type: 'u16', offset: 2 }] },
            { files: ['blind_1.webp'], fields: [{ name: 'depth', type: 'unorm8', offset: 0, min: 0.5, max: 2 }] },
            { files: ['blind_2.webp'], fields: [{ name: 'f', type: 'f32', offset: 0 }] }
        ]
    };

    it('lists valid fields with sanitized identifiers and skips bad ones', function () {
        const { fields, skipped } = blindFields(blindMeta);
        expect(fields.map(f => [f.texture, f.name, f.id, f.offset, f.bytes])).to.deep.equal([
            [0, 'weight', 'weight', 0, 2],
            [0, 'seg-id', 'seg_id', 2, 2],
            [1, 'depth', 'depth', 0, 1],
            [2, 'f', 'f', 0, 4]
        ]);
        expect(skipped).to.deep.equal([]);
        const bad = blindFields({ blind: [{ files: ['x'], fields: [{ name: 'a', type: 'u24', offset: 2 }, { name: 'b', type: 'u9', offset: 0 }, { name: 'c', type: 'u8', offset: 0 }, { name: 'c', type: 'u8', offset: 1 }] }] });
        expect(bad.fields.map(f => f.name)).to.deep.equal(['c']);
        expect(bad.skipped).to.deep.equal(['a', 'b', 'c']);
    });

    it('generates GLSL and WGSL accessors per field', function () {
        const glsl = blindAccessors(blindMeta, false);
        expect(glsl).to.contain('float getBlind_weight()');
        expect(glsl).to.contain('uvec4 b = uvec4(loadBlind0() * 255.0 + 0.5);');
        expect(glsl).to.contain('return unpackHalf2x16(bits).x;');
        expect(glsl).to.contain('uint getBlind_seg_id()');
        expect(glsl).to.contain('uint bits = b.z | (b.w << 8u);');
        expect(glsl).to.contain('return 0.5 + float(bits) / 255.0 * 1.5;');
        expect(glsl).to.contain('return uintBitsToFloat(bits);');
        const wgsl = blindAccessors(blindMeta, true);
        expect(wgsl).to.contain('fn getBlind_seg_id() -> u32');
        expect(wgsl).to.contain('return unpack2x16float(bits).x;');
        expect(wgsl).to.contain('return bitcast<f32>(bits);');
        expect(blindAccessors({}, false)).to.equal('');
    });

    it('decodes each encoding on the CPU', function () {
        // texel 0: f16 1.5 (0x3e00) then u16 513; texel 1: f16 -2 (0xc000) then u16 65535
        const rgba = Uint8Array.from([0x00, 0x3e, 0x01, 0x02, 0x00, 0xc0, 0xff, 0xff]);
        const [weight, segId] = blindFields(blindMeta).fields;
        expect(Array.from(decodeBlindField(rgba, weight, 2))).to.deep.equal([1.5, -2]);
        const ids = decodeBlindField(rgba, segId, 2);
        expect(ids).to.be.instanceOf(Uint32Array);
        expect(Array.from(ids)).to.deep.equal([513, 65535]);
        const depth = blindFields(blindMeta).fields[2];
        const d = decodeBlindField(Uint8Array.from([0, 0, 0, 0, 255, 0, 0, 0]), depth, 2);
        expect(Array.from(d)).to.deep.equal([0.5, 2]);
        const f32 = { type: 'f32', offset: 0, bytes: 4, min: 0, max: 1 };
        const bits = new Uint8Array(new Float32Array([-3.25]).buffer);
        expect(decodeBlindField(bits, f32, 1)[0]).to.equal(-3.25);
    });
});
