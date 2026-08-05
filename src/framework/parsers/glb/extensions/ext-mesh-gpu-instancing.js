import { Mat4 } from '../../../../core/math/mat4.js';
import { Quat } from '../../../../core/math/quat.js';
import { Vec3 } from '../../../../core/math/vec3.js';
import { GltfAccessor } from '../gltf-accessor.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_gpu_instancing
// converts the TRS accessors of instanced nodes to per-instance matrix arrays, stored on the
// nodeInstancingMap entries
const createInstancing = (device, gltf, nodeInstancingMap, bufferViews) => {

    const accessors = gltf.accessors;
    nodeInstancingMap.forEach((data, entity) => {
        const attributes = data.ext.attributes;

        let translations;
        if (attributes.hasOwnProperty('TRANSLATION')) {
            const accessor = accessors[attributes.TRANSLATION];
            translations = GltfAccessor.getDataFloat32(accessor, bufferViews);
        }

        let rotations;
        if (attributes.hasOwnProperty('ROTATION')) {
            const accessor = accessors[attributes.ROTATION];
            rotations = GltfAccessor.getDataFloat32(accessor, bufferViews);
        }

        let scales;
        if (attributes.hasOwnProperty('SCALE')) {
            const accessor = accessors[attributes.SCALE];
            scales = GltfAccessor.getDataFloat32(accessor, bufferViews);
        }

        const instanceCount = (translations ? translations.length / 3 : 0) ||
            (rotations ? rotations.length / 4 : 0) ||
            (scales ? scales.length / 3 : 0);

        if (instanceCount) {

            const matrices = new Float32Array(instanceCount * 16);
            const pos = new Vec3();
            const rot = new Quat();
            const scl = new Vec3(1, 1, 1);
            const matrix = new Mat4();
            let matrixIndex = 0;

            for (let i = 0; i < instanceCount; i++) {
                const i3 = i * 3;
                if (translations) {
                    pos.set(translations[i3], translations[i3 + 1], translations[i3 + 2]);
                }
                if (rotations) {
                    const i4 = i * 4;
                    rot.set(rotations[i4], rotations[i4 + 1], rotations[i4 + 2], rotations[i4 + 3]);
                }
                if (scales) {
                    scl.set(scales[i3], scales[i3 + 1], scales[i3 + 2]);
                }

                matrix.setTRS(pos, rot, scl);

                // copy matrix elements into array of floats
                for (let m = 0; m < 16; m++) {
                    matrices[matrixIndex++] = matrix.data[m];
                }
            }

            data.matrices = matrices;
        }
    });
};

export { createInstancing };
