import {
    Mesh,
    Mat4,
    Quat,
    Vec3
} from 'playcanvas';

import { Tri } from './tri.js';

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();

/**
 * The class for holding mesh triangle data.
 */
class MeshTriData {
    /**
     * The local to parent transform matrix.
     *
     * @type {Mat4}
     */
    _ptm = new Mat4();

    /**
     * The array of triangles for the mesh.
     *
     * @type {import('./tri.js').Tri[]}
     */
    tris;

    constructor(mesh) {
        this.setTris(mesh);
    }

    get ptm() {
        return this._ptm;
    }

    _trisFromMesh(mesh) {
        const tris = [];
        const pos = [];
        const indices = [];
        mesh.getPositions(pos);
        mesh.getIndices(indices);

        for (let k = 0; k < indices.length; k += 3) {
            const i1 = indices[k];
            const i2 = indices[k + 1];
            const i3 = indices[k + 2];

            tmpV1.set(pos[i1 * 3], pos[i1 * 3 + 1], pos[i1 * 3 + 2]);
            tmpV2.set(pos[i2 * 3], pos[i2 * 3 + 1], pos[i2 * 3 + 2]);
            tmpV3.set(pos[i3 * 3], pos[i3 * 3 + 1], pos[i3 * 3 + 2]);
            const tri = new Tri(tmpV1, tmpV2, tmpV3);
            tris.push(tri);
        }
        return tris;
    }

    setTransform(pos = new Vec3(), rot = new Quat(), scale = new Vec3()) {
        this.ptm.setTRS(pos, rot, scale);
    }

    setTris(mesh) {
        if (!mesh || !(mesh instanceof Mesh)) {
            throw new Error('No mesh provided.');
        }
        this.tris = this._trisFromMesh(mesh);
    }
}

export { MeshTriData };
