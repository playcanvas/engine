import { Color } from '../../core/math/color.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PRIMITIVE_TRIANGLES } from '../../platform/graphics/constants.js';
import { BLEND_ADDITIVEALPHA } from '../../scene/constants.js';
import { GraphNode } from '../../scene/graph-node.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Mesh } from '../../scene/mesh.js';

/**
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { EventHandle } from '../../core/event-handle.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { WorldClusters } from '../../scene/lighting/world-clusters.js'
 */

const gridColor = new Color(0.3, 0.3, 0.3);
const colorLow = new Vec3(1, 1, 1);
const colorHigh = new Vec3(40, 0, 0);
const cellMin = new Vec3();
const cellMax = new Vec3();
const cellStep = new Vec3();
const cellColor = new Vec3();

/**
 * Visualizes the clustered lighting of a layer, for debugging. It draws the grid of light clusters
 * as lines, and each cell that contains lights as a cube, colored by the number of lights in it
 * (white for few lights, red for the maximum number of lights per cell). The visualization is
 * rendered on the immediate layer ({@link LAYERID_IMMEDIATE}). It reflects the clusters used in
 * the previous frame.
 *
 * Clustered lighting must be enabled, see {@link Scene#clusteredLightingEnabled}.
 *
 * @example
 * const clustersDebug = new pc.WorldClustersDebug(app);
 * clustersDebug.layer = app.scene.layers.getLayerByName('World');
 *
 * @category Graphics
 */
class WorldClustersDebug {
    /**
     * @type {AppBase}
     * @private
     */
    _app;

    /**
     * @type {Layer|null}
     * @private
     */
    _layer = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _updateHandle = null;

    /**
     * @type {Mesh|null}
     * @private
     */
    _mesh = null;

    /**
     * @type {MeshInstance|null}
     * @private
     */
    _meshInstance = null;

    /**
     * Layer the mesh instance was added to.
     *
     * @type {Layer|null}
     * @private
     */
    _drawLayer = null;

    /** @private */
    _gridPositions = [];

    /** @private */
    _gridColors = [];

    /** @private */
    _positions = [];

    /** @private */
    _colors = [];

    /** @private */
    _indices = [];

    /**
     * Creates a new WorldClustersDebug instance.
     *
     * @param {AppBase} app - The application.
     */
    constructor(app) {
        this._app = app;
        this._updateHandle = app.on('update', this._update, this);
    }

    /**
     * Sets the layer whose light clusters are visualized. Defaults to null, which disables the
     * visualization.
     *
     * @type {Layer|null}
     */
    set layer(value) {
        this._layer = value;
        if (!value) {
            this._hideCells();
        }
    }

    /**
     * Gets the layer whose light clusters are visualized.
     *
     * @type {Layer|null}
     */
    get layer() {
        return this._layer;
    }

    /**
     * Destroys the visualization and releases its resources.
     */
    destroy() {
        this._updateHandle?.off();
        this._updateHandle = null;

        if (this._meshInstance) {
            this._drawLayer?.removeMeshInstances([this._meshInstance]);
            const material = this._meshInstance.material;
            this._meshInstance.destroy();
            material.destroy();
            this._meshInstance = null;
        } else {
            this._mesh?.destroy();
        }
        this._mesh = null;
        this._drawLayer = null;
        this._layer = null;
    }

    /** @private */
    _hideCells() {
        if (this._meshInstance) {
            this._meshInstance.visible = false;
        }
    }

    /** @private */
    _update() {
        const layer = this._layer;
        const clusters = layer ? this._app.renderer.worldClustersAllocator?.getClusters(layer) : null;
        if (!clusters) {
            this._hideCells();
            return;
        }

        const cells = clusters.cells;
        const boundsMin = clusters.lightsBuffer.boundsMin;
        cellStep.copy(clusters.lightsBuffer.boundsDelta).div(cells);

        this._renderGrid(cells, boundsMin, cellStep);
        this._renderCells(clusters, cells, boundsMin, cellStep);
    }

    /**
     * @param {Vec3} cells - The number of cells along each axis.
     * @param {Vec3} boundsMin - The minimum corner of the clusters.
     * @param {Vec3} step - The size of a cell.
     * @private
     */
    _renderGrid(cells, boundsMin, step) {
        const gridPositions = this._gridPositions;
        const gridColors = this._gridColors;

        const maxX = boundsMin.x + step.x * cells.x;
        const maxY = boundsMin.y + step.y * cells.y;
        const maxZ = boundsMin.z + step.z * cells.z;

        // lines along Y, Z and X axes
        for (let a = 0; a <= cells.x; a++) {
            const x = boundsMin.x + a * step.x;
            for (let b = 0; b <= cells.z; b++) {
                const z = boundsMin.z + b * step.z;
                gridPositions.push(x, boundsMin.y, z, x, maxY, z);
            }
            for (let b = 0; b <= cells.y; b++) {
                const y = boundsMin.y + b * step.y;
                gridPositions.push(x, y, boundsMin.z, x, y, maxZ);
            }
        }
        for (let a = 0; a <= cells.y; a++) {
            const y = boundsMin.y + a * step.y;
            for (let b = 0; b <= cells.z; b++) {
                const z = boundsMin.z + b * step.z;
                gridPositions.push(boundsMin.x, y, z, maxX, y, z);
            }
        }

        // update colors only when the number of vertices changes
        const numVerts = gridPositions.length / 3;
        if (numVerts !== gridColors.length / 4) {
            gridColors.length = 0;
            for (let i = 0; i < numVerts; i++) {
                gridColors.push(gridColor.r, gridColor.g, gridColor.b, gridColor.a);
            }
        }

        this._app.drawLineArrays(gridPositions, gridColors);
        gridPositions.length = 0;
    }

    /**
     * @param {WorldClusters} clusters - The clusters.
     * @param {Vec3} cells - The number of cells along each axis.
     * @param {Vec3} boundsMin - The minimum corner of the clusters.
     * @param {Vec3} step - The size of a cell.
     * @private
     */
    _renderCells(clusters, cells, boundsMin, step) {
        const positions = this._positions;
        const colors = this._colors;
        const indices = this._indices;
        positions.length = 0;
        colors.length = 0;
        indices.length = 0;

        const counts = clusters.counts;
        const limit = clusters.maxCellLightCount;

        // add a cube for each cell with lights, colored by its occupancy
        let cubes = 0;
        for (let x = 0; x < cells.x; x++) {
            for (let z = 0; z < cells.z; z++) {
                for (let y = 0; y < cells.y; y++) {

                    const count = counts[x + cells.x * (z + y * cells.z)];
                    if (count > 0) {

                        cellMin.set(boundsMin.x + step.x * x, boundsMin.y + step.y * y, boundsMin.z + step.z * z);
                        cellMax.add2(cellMin, step);

                        positions.push(cellMin.x, cellMin.y, cellMax.z);
                        positions.push(cellMax.x, cellMin.y, cellMax.z);
                        positions.push(cellMax.x, cellMax.y, cellMax.z);
                        positions.push(cellMin.x, cellMax.y, cellMax.z);

                        positions.push(cellMax.x, cellMin.y, cellMin.z);
                        positions.push(cellMin.x, cellMin.y, cellMin.z);
                        positions.push(cellMin.x, cellMax.y, cellMin.z);
                        positions.push(cellMax.x, cellMax.y, cellMin.z);

                        cellColor.lerp(colorLow, colorHigh, count / limit).round();
                        for (let c = 0; c < 8; c++) {
                            colors.push(cellColor.x, cellColor.y, cellColor.z, 1);
                        }

                        const i = cubes * 8;
                        indices.push(
                            i + 0, i + 1, i + 3, i + 3, i + 1, i + 2,   // back
                            i + 4, i + 5, i + 7, i + 7, i + 5, i + 6,   // front
                            i + 3, i + 2, i + 6, i + 2, i + 7, i + 6,   // top
                            i + 1, i + 0, i + 4, i + 0, i + 5, i + 4,   // bottom
                            i + 1, i + 4, i + 2, i + 4, i + 7, i + 2,   // right
                            i + 5, i + 0, i + 6, i + 0, i + 3, i + 6    // left
                        );

                        cubes++;
                    }
                }
            }
        }

        if (!cubes) {
            this._hideCells();
            return;
        }

        if (!this._mesh) {
            this._mesh = new Mesh(this._app.graphicsDevice);
            this._mesh.clear(true, true);
        }

        const mesh = this._mesh;
        mesh.setPositions(positions);
        mesh.setNormals(new Float32Array(positions.length));
        mesh.setColors32(colors);
        mesh.setIndices(indices);
        mesh.update(PRIMITIVE_TRIANGLES, false);

        if (!this._meshInstance) {
            const material = new StandardMaterial();
            material.useLighting = false;
            material.emissive = new Color(1, 1, 1);
            material.emissiveVertexColor = true;
            material.blendType = BLEND_ADDITIVEALPHA;
            material.depthWrite = false;
            material.update();

            const meshInstance = new MeshInstance(mesh, material, new GraphNode('WorldClustersDebug'));
            meshInstance.cull = false;
            meshInstance.castShadows = false;
            this._meshInstance = meshInstance;

            this._drawLayer = this._app.scene.defaultDrawLayer;
            this._drawLayer.addMeshInstances([meshInstance]);
        }

        this._meshInstance.visible = true;
    }
}

export { WorldClustersDebug };
