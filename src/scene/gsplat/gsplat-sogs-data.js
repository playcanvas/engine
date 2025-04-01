
let offscreen = null;
let ctx = null;

const readImageData = (imageBitmap) => {
    if (!offscreen || offscreen.width !== imageBitmap.width || offscreen.height !== imageBitmap.height) {
        offscreen = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        ctx = offscreen.getContext('2d');
        ctx.globalCompositeOperation = 'copy';
    }
    ctx.drawImage(imageBitmap, 0, 0);
    return ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height).data;
};

class GSplatSogsIterator {
    constructor(data, p, r, s, c, sh) {
        // TODO
        this.read = (i) => {
            // TODO
        };
    }
}

class GSplatSogsData {
    meta;

    numSplats;

    means_l;
    means_u;
    quats;
    scales;
    opacities;
    sh0;
    sh_centroids;
    sh_labels_l;
    sh_labels_u;

    createIter(p, r, s, c, sh) {
        return new GSplatSogsIterator(this, p, r, s, c, sh);
    }

    calcAabb(result) {
        const { mins, maxs } = this.meta.means;

        const map = v => Math.sign(v) * (Math.exp(Math.abs(v)) - 1);

        result.center.set(
            (map(mins[0]) + map(maxs[0])) * 0.5,
            (map(mins[1]) + map(maxs[1])) * 0.5,
            (map(mins[2]) + map(maxs[2])) * 0.5
        );

        result.halfExtents.set(
            (map(maxs[0]) - map(mins[0])) * 0.5,
            (map(maxs[1]) - map(mins[1])) * 0.5,
            (map(maxs[2]) - map(mins[2])) * 0.5
        );
    }

    getCenters(result) {
        const lerp = (a, b, t) => a * (1 - t) + b * t;

        // extract means for centers
        const { meta, means_l, means_u } = this;
        const { means } = meta;
        const meansL = readImageData(means_l._levels[0]);
        const meansU = readImageData(means_u._levels[0]);

        // combine high and low
        for (let i = 0; i < this.numSplats; i++) {
            const nx = lerp(means.mins[0], means.maxs[0], ((meansU[i * 4 + 0] << 8) + meansL[i * 4 + 0]) / 65535);
            const ny = lerp(means.mins[1], means.maxs[1], ((meansU[i * 4 + 1] << 8) + meansL[i * 4 + 1]) / 65535);
            const nz = lerp(means.mins[2], means.maxs[2], ((meansU[i * 4 + 2] << 8) + meansL[i * 4 + 2]) / 65535);

            result[i * 3 + 0] = Math.sign(nx) * (Math.exp(Math.abs(nx)) - 1);
            result[i * 3 + 1] = Math.sign(ny) * (Math.exp(Math.abs(ny)) - 1);
            result[i * 3 + 2] = Math.sign(nz) * (Math.exp(Math.abs(nz)) - 1);
        }
    }

    calcFocalPoint(result, pred) {
        result.set(0, 0, 0);
    }

    get isSogs() {
        return true;
    }

    decompress() {
        const members = [
            'x', 'y', 'z',
            'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
            'scale_0', 'scale_1', 'scale_2',
            'rot_0', 'rot_1', 'rot_2', 'rot_3'
        ];

        const shBands = 3;

        // allocate spherical harmonics data
        if (shBands > 0) {
            const shMembers = [];
            for (let i = 0; i < 45; ++i) {
                shMembers.push(`f_rest_${i}`);
            }
            members.splice(members.indexOf('f_dc_0') + 1, 0, ...shMembers);
        }

        // allocate uncompressed data
        const data = {};
        members.forEach((name) => {
            data[name] = new Float32Array(this.numSplats);
        });

        const p = new Vec3();
        const r = new Quat();
        const s = new Vec3();
        const c = new Vec4();
        const sh = shBands > 0 ? new Float32Array(45) : null;

        const iter = this.createIter(p, r, s, c, sh);

        for (let i = 0; i < this.numSplats; ++i) {
            iter.read(i);

            data.x[i] = p.x;
            data.y[i] = p.y;
            data.z[i] = p.z;

            data.rot_1[i] = r.x;
            data.rot_2[i] = r.y;
            data.rot_3[i] = r.z;
            data.rot_0[i] = r.w;

            data.scale_0[i] = s.x;
            data.scale_1[i] = s.y;
            data.scale_2[i] = s.z;

            data.f_dc_0[i] = (c.x - 0.5) / SH_C0;
            data.f_dc_1[i] = (c.y - 0.5) / SH_C0;
            data.f_dc_2[i] = (c.z - 0.5) / SH_C0;
            // convert opacity to log sigmoid taking into account infinities at 0 and 1
            data.opacity[i] = (c.w <= 0) ? -40 : (c.w >= 1) ? 40 : -Math.log(1 / c.w - 1);

            if (sh) {
                for (let c = 0; c < 45; ++c) {
                    data[`f_rest_${c}`][i] = sh[c];
                }
            }
        }

        return new GSplatData([{
            name: 'vertex',
            count: this.numSplats,
            properties: members.map((name) => {
                return {
                    name: name,
                    type: 'float',
                    byteSize: 4,
                    storage: data[name]
                };
            })
        }]);
    }
}

export { GSplatSogsData };
