import { Mat4 } from '../../core/math/mat4.js';

import { PRIMITIVE_LINES } from '../../platform/graphics/constants.js';
import { Mesh } from '../../scene/mesh.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Vec3 } from '../../core/math/vec3.js';

const identityGraphNode = new GraphNode();
identityGraphNode.worldTransform = Mat4.IDENTITY;
identityGraphNode._dirtyWorld = identityGraphNode._dirtyNormal = false;

// helper class storing data for a single batch of line rendering using a single material
class ImmediateBatch {
    constructor(device, material, layer) {
        this.material = material;
        this.layer = layer;

        // line data, arrays of numbers
        this.positions = [];
        this.colors = [];
        // stores length of line for each vertex plus
        // a normalized t [0..1] to know where we are on the
        // line (more like a 1D UV)
        this.tAndLength = [];

        this.mesh = new Mesh(device);
        this.meshInstance = null;

        this.helperA = new Vec3();
        this.helperB = new Vec3();
    }

    // add line positions and colors to the batch
    // this function expects position in Vec3 and colors in Color format
    addLines(positions, color) {

        // positions
        const destPos = this.positions;
        const destTAndLength = this.tAndLength;
        const count = positions.length;
        for (let i = 0; i < count; i += 2) {
            const pos1 = positions[i];
            const pos2 = positions[i + 1];
            destPos.push(pos1.x, pos1.y, pos1.z);
            destPos.push(pos2.x, pos2.y, pos2.z);
            const length = pos2.distance(pos1);
            destTAndLength.push(0, length);
            destTAndLength.push(1, length);
        }

        // colors
        const destCol = this.colors;
        if (color.length) {
            // multi colored line
            for (let i = 0; i < count; i++) {
                const col = color[i];
                destCol.push(col.r, col.g, col.b, col.a);
            }
        } else {
            // single colored line
            for (let i = 0; i < count; i++) {
                destCol.push(color.r, color.g, color.b, color.a);
            }
        }
    }

    // add line positions and colors to the batch
    // this function expects positions as arrays of numbers
    // and color as instance of Color or array of number specifying the same number of vertices as positions
    addLinesArrays(positions, color) {

        // positions
        const destPos = this.positions;
        const destTAndLength = this.tAndLength;
        for (let i = 0; i < positions.length; i += 6) {
            destPos.push(positions[i], positions[i + 1], positions[i + 2]);
            this.helperA.set(positions[i], positions[i + 1], positions[i + 2]);

            destPos.push(positions[i + 3], positions[i + 4], positions[i + 5]);
            this.helperB.set(positions[i + 3], positions[i + 4], positions[i + 5]);

            const length = this.helperB.distance(this.helperA);

            destTAndLength.push(0, length);
            destTAndLength.push(1, length);
        }

        // colors
        const destCol = this.colors;
        if (color.length) {
            for (let i = 0; i < color.length; i += 4) {
                destCol.push(color[i], color[i + 1], color[i + 2], color[i + 3]);
            }
        } else {
            // single colored line
            const count = positions.length / 3;
            for (let i = 0; i < count; i++) {
                destCol.push(color.r, color.g, color.b, color.a);
            }
        }
    }

    onPreRender(visibleList, transparent) {

        // prepare mesh if its transparency matches
        if (this.positions.length > 0 && this.material.transparent === transparent) {

            // update mesh vertices
            this.mesh.setPositions(this.positions);
            this.mesh.setUvs(0, this.tAndLength);
            this.mesh.setColors(this.colors);
            this.mesh.update(PRIMITIVE_LINES, false);
            if (!this.meshInstance) {
                this.meshInstance = new MeshInstance(this.mesh, this.material, identityGraphNode);
            }

            // clear lines when after they were rendered as their lifetime is one frame
            this.positions.length = 0;
            this.tAndLength.length = 0;
            this.colors.length = 0;

            // inject mesh instance into visible list to be rendered
            visibleList.list.push(this.meshInstance);
            visibleList.length++;
        }
    }
}

export { ImmediateBatch };
