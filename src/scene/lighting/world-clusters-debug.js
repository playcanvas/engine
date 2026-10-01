import { Color } from '../../core/math/color.js';
import { Vec3 } from '../../core/math/vec3.js';

import { PRIMITIVE_TRIANGLES } from '../../platform/graphics/constants.js';

import { BLEND_ADDITIVEALPHA } from '../constants.js';
import { GraphNode } from '../graph-node.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { StandardMaterial } from '../materials/standard-material.js';

/**
 * @import { Layer } from '../layer.js'
 */

class WorldClustersDebug {
    gridPositions = [];

    gridColors = [];

    mesh = null;

    meshInstance = null;

    /** @type {MeshInstance|null} */
    _pendingMeshInstance = null;

    /** @type {Layer|null} */
    _layer = null;

    colorLow = new Vec3(1, 1, 1);

    colorHigh = new Vec3(40, 0, 0);

    frameUpdate() {
        // Discard debug output if its destination layer was not rendered last frame.
        this._pendingMeshInstance = null;
        this._layer = null;
    }

    /**
     * @param {Layer} layer - The layer being rendered.
     * @param {MeshInstance[]} visibleList - The visible mesh instances for the layer.
     */
    onPreRenderLayer(layer, visibleList) {
        // Cluster occupancy is generated during rendering, after scene visibility culling.
        if (this._pendingMeshInstance && layer === this._layer) {
            visibleList.push(this._pendingMeshInstance);
            this._pendingMeshInstance = null;
            this._layer = null;
        }
    }

    render(worldClusters, scene) {

        this.frameUpdate();

        const device = scene.device;
        const cells = worldClusters.cells;
        const lightsBuffer = worldClusters.lightsBuffer;
        const boundsMin = lightsBuffer.boundsMin;
        const boundsDelta = lightsBuffer.boundsDelta;
        const boundsMax = boundsMin.clone().add(boundsDelta);
        const cellDelta = lightsBuffer.boundsDelta.clone().div(cells);

        const gridPositions = this.gridPositions;
        const gridColors = this.gridColors;

        const c1 = new Color(0.3, 0.3, 0.3);

        const renderCellLines = (countA, countB, minA, deltaA, minB, deltaB, minC, maxC, order) => {
            for (let a = 0; a <= countA; a++) {
                for (let b = 0; b <= countB; b++) {
                    const aa = minA + a * deltaA;
                    const bb = minB + b * deltaB;
                    if (order === 0) {
                        gridPositions.push(aa, minC, bb, aa, maxC, bb);
                    } else if (order === 1) {
                        gridPositions.push(aa, bb, minC, aa, bb, maxC);
                    } else if (order === 2) {
                        gridPositions.push(minC, aa, bb, maxC, aa, bb);
                    }
                }
            }
        };

        // generate grid lines
        renderCellLines(cells.x, cells.z, boundsMin.x, cellDelta.x, boundsMin.z, cellDelta.z, boundsMin.y, boundsMax.y, 0);
        renderCellLines(cells.x, cells.y, boundsMin.x, cellDelta.x, boundsMin.y, cellDelta.y, boundsMin.z, boundsMax.z, 1);
        renderCellLines(cells.y, cells.z, boundsMin.y, cellDelta.y, boundsMin.z, cellDelta.z, boundsMin.x, boundsMax.x, 2);

        // render grid lines
        if (gridPositions.length) {

            // update colors only when needed
            const numVerts = gridPositions.length / 3;
            if (numVerts !== gridColors.length / 4) {
                gridColors.length = 0;
                for (let i = 0; i < numVerts; i++) {
                    gridColors.push(c1.r, c1.g, c1.b, c1.a);
                }
            }

            scene.drawLineArrays(gridPositions, gridColors);
            gridPositions.length = 0;
        }

        // render cell occupancy
        let mesh = this.mesh;
        if (!mesh) {
            mesh = new Mesh(device);
            mesh.clear(true, true);
            this.mesh = mesh;
        }

        const positions = [];
        const colors = [];
        const indices = [];

        const divX = worldClusters._cells.x;
        const divZ = worldClusters._cells.z;
        const counts = worldClusters.counts;
        const limit = worldClusters._maxCellLightCount;

        const min = new Vec3();
        const max = new Vec3();
        const col = new Vec3();
        const step = boundsDelta.clone().div(cells);

        // add cubes with a color representing cell occupancy to the dynamic mesh
        let cubes = 0;
        for (let x = 0; x < cells.x; x++) {
            for (let z = 0; z < cells.z; z++) {
                for (let y = 0; y < cells.y; y++) {

                    const clusterIndex = x + divX * (z + y * divZ);
                    const count = counts[clusterIndex];

                    if (count > 0) {

                        // cube corners
                        min.x = boundsMin.x + step.x * x;
                        min.y = boundsMin.y + step.y * y;
                        min.z = boundsMin.z + step.z * z;
                        max.add2(min, step);

                        positions.push(min.x, min.y, max.z);
                        positions.push(max.x, min.y, max.z);
                        positions.push(max.x, max.y, max.z);
                        positions.push(min.x, max.y, max.z);

                        positions.push(max.x, min.y, min.z);
                        positions.push(min.x, min.y, min.z);
                        positions.push(min.x, max.y, min.z);
                        positions.push(max.x, max.y, min.z);

                        col.lerp(this.colorLow, this.colorHigh, count / limit).round();
                        for (let c = 0; c < 8; c++) {
                            colors.push(col.x, col.y, col.z, 1);
                        }

                        // back
                        indices.push(cubes * 8 + 0, cubes * 8 + 1, cubes * 8 + 3);
                        indices.push(cubes * 8 + 3, cubes * 8 + 1, cubes * 8 + 2);

                        // front
                        indices.push(cubes * 8 + 4, cubes * 8 + 5, cubes * 8 + 7);
                        indices.push(cubes * 8 + 7, cubes * 8 + 5, cubes * 8 + 6);

                        // top
                        indices.push(cubes * 8 + 3, cubes * 8 + 2, cubes * 8 + 6);
                        indices.push(cubes * 8 + 2, cubes * 8 + 7, cubes * 8 + 6);

                        // bottom
                        indices.push(cubes * 8 + 1, cubes * 8 + 0, cubes * 8 + 4);
                        indices.push(cubes * 8 + 0, cubes * 8 + 5, cubes * 8 + 4);

                        // right
                        indices.push(cubes * 8 + 1, cubes * 8 + 4, cubes * 8 + 2);
                        indices.push(cubes * 8 + 4, cubes * 8 + 7, cubes * 8 + 2);

                        // left
                        indices.push(cubes * 8 + 5, cubes * 8 + 0, cubes * 8 + 6);
                        indices.push(cubes * 8 + 0, cubes * 8 + 3, cubes * 8 + 6);

                        cubes++;
                    }
                }
            }
        }

        if (cubes) {
            mesh.setPositions(positions);
            mesh.setNormals(new Float32Array(positions.length));
            mesh.setColors32(colors);
            mesh.setIndices(indices);
            mesh.update(PRIMITIVE_TRIANGLES, false);

            if (!this.meshInstance) {
                const material = new StandardMaterial();
                material.useLighting = false;
                material.emissive = new Color(1, 1, 1);
                material.emissiveVertexColor = true;
                material.blendType = BLEND_ADDITIVEALPHA;
                material.depthWrite = false;
                material.update();

                const node = new GraphNode('WorldClustersDebug');
                this.meshInstance = new MeshInstance(mesh, material, node);
                this.meshInstance.cull = false;
                this.meshInstance.castShadow = false;
            }

            this._pendingMeshInstance = this.meshInstance;
            this._layer = scene.defaultDrawLayer;
        }
    }

    destroy() {
        this.frameUpdate();
        if (this.meshInstance) {
            const material = this.meshInstance.material;
            this.meshInstance.destroy();
            material.destroy();
            this.meshInstance = null;
        } else {
            this.mesh?.destroy();
        }
        this.mesh = null;
    }
}

export { WorldClustersDebug };
