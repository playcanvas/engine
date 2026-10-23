import { math } from '../../../core/math/math.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Entity } from '../../../framework/entity.js';
import { BlendState } from '../../../platform/graphics/blend-state.js';
import {
    BUFFER_DYNAMIC,
    SEMANTIC_ATTR8,
    SEMANTIC_ATTR9,
    SEMANTIC_ATTR10,
    SEMANTIC_ATTR11,
    SEMANTIC_ATTR12,
    TYPE_FLOAT32
} from '../../../platform/graphics/constants.js';
import { VertexBuffer } from '../../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../platform/graphics/vertex-format.js';
import { CylinderGeometry } from '../../../scene/geometry/cylinder-geometry.js';
import { ShaderMaterial } from '../../../scene/materials/shader-material.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Mesh } from '../../../scene/mesh.js';
import { Pool } from '../pool.js';
import { lineBatchShader } from '../shaders.js';

/**
 * @import { Color } from '../../../core/math/color.js'
 * @import { AppBase } from '../../../framework/app-base.js'
 * @import { Layer } from '../../../scene/layer.js'
 */

/**
 * A run of consecutive lines, drawn as one instanced draw call per pass.
 *
 * @typedef {object} LineRun
 * @property {Entity} entity - The entity of the run.
 * @property {MeshInstance[]} meshInstances - The occluded and the depth tested pass.
 * @property {VertexBuffer} vertexBuffer - The instance data.
 * @property {Float32Array} data - The storage of the instance data.
 * @property {number} capacity - The number of lines the instance data holds.
 * @property {number} count - The number of lines added this frame.
 */

const tmpDir = new Vec3();
const tmpPos = new Vec3();
const tmpScale = new Vec3();
const tmpQ = new Quat();
const tmpLocal = new Mat4();
const tmpWorld = new Mat4();

// three rows of the world transform, then the color and the occluded color
const FLOATS_PER_LINE = 20;
const MIN_CAPACITY = 16;

/**
 * Lines drawn as instanced cylinders, added each frame between {@link begin} and {@link end}.
 * Consecutive lines form a run with its own entity, drawn as an occluded pass then a depth tested
 * pass, so in a manually sorted layer it keeps its place among other shapes. {@link split} starts
 * a new run.
 *
 * @ignore
 */
class MeshLineBatch {
    /**
     * The runs, taken in order each frame.
     *
     * @type {Pool<LineRun>}
     * @private
     */
    _runs;

    /**
     * The run lines are added to, or null to start a new run.
     *
     * @type {LineRun|null}
     * @private
     */
    _run = null;

    /**
     * The draw order of the next run in a manually sorted layer.
     *
     * @type {number}
     */
    drawOrder;

    /**
     * The layer of the lines.
     *
     * @type {Layer}
     * @private
     */
    _layer;

    /**
     * Whether the lines were destroyed.
     *
     * @private
     */
    _destroyed = false;

    /**
     * @param {AppBase} app - The application.
     * @param {Layer} layer - The layer of the lines.
     * @param {Entity} parent - The parent of the lines, which the line points are relative to.
     * @param {number} drawOrder - The draw order of the first run in a manually sorted layer.
     */
    constructor(app, layer, parent, drawOrder) {
        const device = app.graphicsDevice;
        this._parent = parent;
        this._layer = layer;
        this.drawOrder = drawOrder;
        this._material = this._createMaterial(false);
        this._occludedMaterial = this._createMaterial(true);
        this._mesh = Mesh.fromGeometry(device, new CylinderGeometry());
        this._mesh.incRefCount();
        const format = new VertexFormat(device, [
            { semantic: SEMANTIC_ATTR8, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR9, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR10, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR11, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR12, components: 4, type: TYPE_FLOAT32 }
        ]);

        this._runs = new Pool(() => {
            const meshInstances = [
                new MeshInstance(this._mesh, this._occludedMaterial),
                new MeshInstance(this._mesh, this._material)
            ];
            const vertexBuffer = new VertexBuffer(device, format, MIN_CAPACITY, { usage: BUFFER_DYNAMIC });
            for (let i = 0; i < meshInstances.length; i++) {
                meshInstances[i].setInstancing(vertexBuffer);
            }
            const entity = new Entity('mesh-lines');
            entity.addComponent('render', {
                meshInstances,
                layers: [this._layer.id],
                castShadows: false
            });
            parent.addChild(entity);
            const data = new Float32Array(vertexBuffer.lock());
            return { entity, meshInstances, vertexBuffer, data, capacity: MIN_CAPACITY, count: 0 };
        });
    }

    /**
     * Sets the layer of the lines.
     *
     * @type {Layer}
     */
    set layer(value) {
        this._layer = value;
        const ids = [value.id];
        const runs = this._runs.items;
        for (let i = 0; i < runs.length; i++) {
            const { render } = runs[i].entity;
            if (render) {
                render.layers = ids;
            }
        }
    }

    /**
     * Gets the layer of the lines.
     *
     * @type {Layer}
     */
    get layer() {
        return this._layer;
    }

    /**
     * @param {boolean} occluded - Whether the material draws the occluded pass.
     * @returns {ShaderMaterial} The material.
     * @private
     */
    _createMaterial(occluded) {
        const material = new ShaderMaterial(lineBatchShader);
        material.blendState = BlendState.ALPHABLEND;
        if (occluded) {
            material.setDefine('OCCLUDED', true);
            material.depthTest = false;
            material.depthWrite = false;
        }
        material.update();
        return material;
    }

    /**
     * Doubles the instance data of a run, keeping the lines added so far.
     *
     * @param {LineRun} run - The run.
     * @private
     */
    _grow(run) {
        const capacity = 2 * run.capacity;
        const vertexBuffer = new VertexBuffer(run.vertexBuffer.device, run.vertexBuffer.format, capacity, {
            usage: BUFFER_DYNAMIC
        });
        const data = new Float32Array(vertexBuffer.lock());
        data.set(run.data);
        for (let i = 0; i < run.meshInstances.length; i++) {
            run.meshInstances[i].setInstancing(vertexBuffer);
        }
        run.vertexBuffer.destroy();
        run.vertexBuffer = vertexBuffer;
        run.data = data;
        run.capacity = capacity;
    }

    /**
     * Starts adding the lines of a frame.
     */
    begin() {
        this._runs.count = 0;
        this._run = null;
    }

    /**
     * Ends the current run, so the next line draws after the shapes placed in between.
     */
    split() {
        this._run = null;
    }

    /**
     * Adds a line from one point to another.
     *
     * @param {Vec3} from - The start point, relative to the parent.
     * @param {Vec3} to - The end point, relative to the parent.
     * @param {number} thickness - The thickness of the line.
     * @param {Color} color - The color of the line.
     * @param {Color} occludedColor - The color where the scene hides the line.
     */
    add(from, to, thickness, color, occludedColor) {
        let run = this._run;
        if (!run) {
            run = this._run = this._runs.next();
            run.entity.enabled = true;
            run.count = 0;
            for (let i = 0; i < run.meshInstances.length; i++) {
                run.meshInstances[i].drawOrder = this.drawOrder;
            }
        }
        if (run.count === run.capacity) {
            this._grow(run);
        }

        // a cylinder along y, turned to the line
        const dir = tmpDir.sub2(to, from).normalize();
        const elev = Math.atan2(-dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z)) * math.RAD_TO_DEG;
        const azim = Math.atan2(-dir.x, -dir.z) * math.RAD_TO_DEG;
        tmpQ.setFromEulerAngles(-elev + 90, azim, 0);
        const length = from.distance(to);
        tmpPos.copy(dir.mulScalar(0.5 * length).add(from));
        tmpLocal.setTRS(tmpPos, tmpQ, tmpScale.set(thickness, length, thickness));
        const m = tmpWorld.mulAffine2(this._parent.getWorldTransform(), tmpLocal).data;

        const data = run.data;
        let i = run.count * FLOATS_PER_LINE;
        for (let row = 0; row < 3; row++) {
            data[i++] = m[row];
            data[i++] = m[row + 4];
            data[i++] = m[row + 8];
            data[i++] = m[row + 12];
        }
        data[i++] = color.r;
        data[i++] = color.g;
        data[i++] = color.b;
        data[i++] = color.a;
        data[i++] = occludedColor.r;
        data[i++] = occludedColor.g;
        data[i++] = occludedColor.b;
        data[i] = occludedColor.a;
        run.count++;
    }

    /**
     * Uploads the runs of the frame and hides unused runs.
     */
    end() {
        const { items, count } = this._runs;
        for (let i = 0; i < items.length; i++) {
            const run = items[i];
            if (i >= count) {
                run.entity.enabled = false;
                continue;
            }
            run.vertexBuffer.unlock();
            for (let j = 0; j < run.meshInstances.length; j++) {
                run.meshInstances[j].instancingCount = run.count;
            }
        }
        this._run = null;
    }

    /**
     * Destroys the lines. Safe to call again.
     */
    destroy() {
        if (this._destroyed) {
            return;
        }
        this._destroyed = true;
        const runs = this._runs.items;
        for (let i = 0; i < runs.length; i++) {
            runs[i].entity.destroy();
            runs[i].vertexBuffer.destroy();
        }
        runs.length = 0;
        this._mesh.decRefCount();
        if (this._mesh.refCount < 1) {
            this._mesh.destroy();
        }
        this._material.destroy();
        this._occludedMaterial.destroy();
    }
}

export { MeshLineBatch };
