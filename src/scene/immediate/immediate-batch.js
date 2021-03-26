import { Mat4 } from '../../math/mat4.js';

import { PRIMITIVE_LINES } from '../../graphics/constants.js';
import { Mesh } from '../../scene/mesh.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { GraphNode } from '../../scene/graph-node.js';

var identityGraphNode = new GraphNode();

// helper class storing data for a single batch of line rendering using a single material
class ImmediateBatch {
    constructor(device, material, layer) {
        this.material = material;
        this.layer = layer;

        // line data, arrays of numbers
        this.positions = [];
        this.colors = [];

        this.mesh = new Mesh(device);
        this.meshInstance = null;
    }

    // add line positions and colors to the batch
    addLines(positions, color) {

        // positions
        const destPos = this.positions;
        const count = positions.length;
        for (let i = 0; i < count; i++) {
            const pos = positions[i];
            destPos.push(pos.x, pos.y, pos.z);
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

    onPreRender() {
        if (this.positions.length > 0) {

            // update mesh vertices
            this.mesh.setPositions(this.positions);
            this.mesh.setColors(this.colors);
            this.mesh.update(PRIMITIVE_LINES, false);

            if (!this.meshInstance) {
                identityGraphNode.worldTransform = Mat4.IDENTITY;
                identityGraphNode._dirtyWorld = identityGraphNode._dirtyNormal = false;
                this.meshInstance = new MeshInstance(this.mesh, this.material, identityGraphNode);
                this.meshInstance.cull = false;

                // mesh instance is permanently added to the layer, and only marked invisible when no lines need
                // to be rendered to avoid the cost of layer composition update when adding / removing
                this.layer.addMeshInstances([this.meshInstance], true);
            }

            this.meshInstance.visible = true;
        }
    }

    onPostRender() {
        // clear lines when after they were rendered as their lifetime is one frame
        this.positions.length = 0;
        this.colors.length = 0;
        this.meshInstance.visible = false;
    }
}

export { ImmediateBatch };
