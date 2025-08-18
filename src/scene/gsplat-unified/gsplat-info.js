import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import { Vec4 } from '../../core/math/vec4.js';
import glslGsplatCopyToWorkBufferPS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import wgslGsplatCopyToWorkBufferPS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import { GSplatIntervalTexture } from './gsplat-interval-texture.js';

/**
 * @import { GraphicsDevice } from "../../platform/graphics/graphics-device.js";
 * @import { GSplatResource } from "../gsplat/gsplat-resource.js"
 * @import { GSplatPlacement } from "./gsplat-placement.js"
 * @import { GraphNode } from '../graph-node.js';
 */

const _lodColors = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [1, 0, 1]
];

// enable to colorize LODs
const colorizeLod = false;

const _viewMat = new Mat4();

/**
 * @ignore
 */
class GSplatInfo {
    /** @type {GraphicsDevice} */
    device;

    /** @type {GSplatResource} */
    resource;

    /** @type {GraphNode} */
    node;

    /** @type {number} */
    lodIndex;

    /** @type {number} */
    numSplats;

    /** @type {number} */
    activeSplats = 0;

    /**
     * Array of intervals for remapping of indices, each two consecutive numbers represent
     * start and end of a range of splats.
     *
     * @type {number[]}
     */
    intervals = [];

    /** @type {number} */
    lineStart = 0;

    /** @type {number} */
    lineCount = 0;

    /** @type {number} */
    padding = 0;

    /** @type {Vec4} */
    viewport = new Vec4();

    /** @type {Mat4} */
    previousWorldTransform = new Mat4();

    /** @type {number} */
    updateVersion = 0;

    /**
     * Material is used as a container for parameters only.
     *
     * @type {ShaderMaterial}
     */
    material;

    /**
     * Manager for the intervals texture generation
     *
     * @type {GSplatIntervalTexture}
     */
    intervalTexture;

    /**
     * Create a new GSplatInfo.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatResource} resource - The splat resource.
     * @param {GSplatPlacement} placement - The placement of the splat.
     */
    constructor(device, resource, placement) {
        Debug.assert(resource);
        Debug.assert(placement);

        this.device = device;
        this.resource = resource;
        this.node = placement.node;
        this.lodIndex = placement.lodIndex;
        this.numSplats = resource.centers.length / 3;

        this.intervalTexture = new GSplatIntervalTexture(device);
        this.updateIntervals(placement.intervals);

        this.material = new ShaderMaterial();
        resource.configureMaterial(this.material);

        this.copyShader = this.createCopyShader(placement.intervals);
    }

    destroy() {
        this.device = null;
        this.resource = null;
        this.copyShader = null;

        this.intervals.length = 0;
        this.intervalTexture.destroy();
        this.material.destroy();
    }

    createCopyShader(intervals) {

        // defines configured on the material that set up correct shader variant to be compiled
        const defines = new Map(this.material.defines);
        if (intervals.size > 0) defines.set('GSPLAT_LOD', '');
        if (colorizeLod) defines.set('GSPLAT_COLORIZE', '');
        const definesKey = Array.from(defines.entries()).map(([k, v]) => `${k}=${v}`).join(';');
        return ShaderUtils.createShader(this.device, {
            uniqueName: `SplatCopyToWorkBuffer:${definesKey}`,
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexDefines: defines,
            fragmentDefines: defines,
            vertexChunk: 'fullscreenQuadVS',
            fragmentGLSL: glslGsplatCopyToWorkBufferPS,
            fragmentWGSL: wgslGsplatCopyToWorkBufferPS
        });
    }

    setLines(start, count, textureSize, activeSplats) {
        this.lineStart = start;
        this.lineCount = count;
        this.padding = textureSize * count - activeSplats;
        Debug.assert(this.padding >= 0);
        this.viewport.set(0, start, textureSize, count);
    }

    updateIntervals(intervals) {

        const resource = this.resource;
        this.intervals.length = 0;
        this.activeSplats = resource.numSplats;

        // If placement has intervals defined
        if (intervals.size > 0) {

            // copy the intervals to the state
            for (const interval of intervals.values()) {
                this.intervals.push(interval.x, interval.y + 1);
            }

            this.activeSplats = this.intervalTexture.update(this.intervals);
        }
    }

    update(updateVersion) {

        // if the object's matrix has changed, store the update version to know when it happened
        const worldMatrix = this.node.getWorldTransform();
        const worldMatrixChanged = !this.previousWorldTransform.equals(worldMatrix);
        if (worldMatrixChanged) {
            this.previousWorldTransform.copy(worldMatrix);
            this.updateVersion = updateVersion;
        }

        return worldMatrixChanged;
    }

    render(renderTarget, cameraNode, lodIndex = 0) {
        const { device, resource } = this;
        const scope = device.scope;
        Debug.assert(resource);

        // render using render state
        const { activeSplats, lineStart, viewport, intervalTexture } = this;
        Debug.assert(activeSplats > 0);

        // assign material properties to scope
        this.material.setParameters(this.device);

        // matrix to transform splats to the world space
        scope.resolve('uTransform').setValue(this.node.getWorldTransform().data);

        if (intervalTexture.texture) {
            // Set LOD intervals texture for remapping of indices
            scope.resolve('uIntervalsTexture').setValue(intervalTexture.texture);
        }

        scope.resolve('uActiveSplats').setValue(activeSplats);
        scope.resolve('uStartLine').setValue(lineStart);
        scope.resolve('uViewportWidth').setValue(viewport.z);

        if (colorizeLod) {
            scope.resolve('uLodColor').setValue(_lodColors[lodIndex]);
        }

        // SH related
        scope.resolve('matrix_model').setValue(this.node.getWorldTransform().data);

        const viewInvMat = cameraNode.getWorldTransform();
        const viewMat = _viewMat.copy(viewInvMat).invert();
        scope.resolve('matrix_view').setValue(viewMat.data);

        drawQuadWithShader(device, renderTarget, this.copyShader, viewport, viewport);
    }
}

export { GSplatInfo };
