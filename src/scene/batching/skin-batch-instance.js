import { SkinInstance } from '../skin-instance.js';

// Class derived from SkinInstance with changes to make it suitable for batching
class SkinBatchInstance extends SkinInstance {
    constructor(device, nodes, rootNode) {

        super();

        var numBones = nodes.length;
        this.init(device, numBones);

        this.device = device;
        this.rootNode = rootNode;

        // Unique bones per clone
        this.bones = nodes;
    }

    updateMatrices(rootNode, skinUpdateIndex) {
    }

    updateMatrixPalette(rootNode, skinUpdateIndex) {
        var pe;
        var mp = this.matrixPalette;
        var base;

        var count = this.bones.length;
        for (var i = 0; i < count; i++) {
            pe = this.bones[i].getWorldTransform().data;

            // Copy the matrix into the palette, ready to be sent to the vertex shader, transpose matrix from 4x4 to 4x3 format as well
            base = i * 12;
            mp[base] = pe[0];
            mp[base + 1] = pe[4];
            mp[base + 2] = pe[8];
            mp[base + 3] = pe[12];
            mp[base + 4] = pe[1];
            mp[base + 5] = pe[5];
            mp[base + 6] = pe[9];
            mp[base + 7] = pe[13];
            mp[base + 8] = pe[2];
            mp[base + 9] = pe[6];
            mp[base + 10] = pe[10];
            mp[base + 11] = pe[14];
        }

        this.uploadBones(this.device);
    }
}

export { SkinBatchInstance };
