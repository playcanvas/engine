import { Debug } from '../../../core/debug.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { SEMANTIC_POSITION } from '../../../platform/graphics/constants.js';
import { drawQuadWithShader } from '../../graphics/quad-render-utils.js';
import { ShaderMaterial } from '../../materials/shader-material.js';
import { ShaderUtils } from '../../shader-lib/shader-utils.js';
import { GSplatLod } from './gspat-lod.js';
import glslGsplatCopyToWorkBufferPS from '../../shader-lib/glsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import wgslGsplatCopyToWorkBufferPS from '../../shader-lib/wgsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import { Mat4 } from '../../../core/math/mat4.js';

/**
 * @import { GraphNode } from "../../graph-node.js";
 * @import { GraphicsDevice } from "../../../platform/graphics/graphics-device.js";
 * @import { GSplatResource } from "../gsplat-resource.js"
 */

/**
 * @ignore
 */
class GSplatInfo {
    /** @type {GraphicsDevice} */
    device;

    /** @type {GSplatResource} */
    resource;

    /** @type {number} */
    numSplats;

    /** @type {GraphNode} */
    node;

    /** @type {number} */
    lineStart;

    /** @type {number} */
    lineCount;

    /** @type {Vec4} */
    viewport = new Vec4();

    /** @type {GSplatLod} */
    lod;

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

    constructor(device, resource, node) {
        Debug.assert(resource);
        Debug.assert(node);

        this.device = device;
        this.resource = resource;
        this.node = node;
        this.numSplats = resource.centers.length / 3;
        this.lod = new GSplatLod(device, this);

        this.material = new ShaderMaterial();
        resource.configureMaterial(this.material);

        // defines configured on the material that set up correct shader variant to be compiled
        const defines = new Map(this.material.defines);
        if (resource.hasLod) defines.set('GSPLAT_LOD', '');
        const definesKey = Array.from(defines.entries()).map(([k, v]) => `${k}=${v}`).join(';');
        this.copyShader = ShaderUtils.createShader(device, {
            uniqueName: `SplatCopyToWorkBuffer:${definesKey}`,
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexDefines: defines,
            fragmentDefines: defines,
            vertexChunk: 'fullscreenQuadVS',
            fragmentGLSL: glslGsplatCopyToWorkBufferPS,
            fragmentWGSL: wgslGsplatCopyToWorkBufferPS
        });
    }

    destroy() {
        this.device = null;
        this.resource = null;
        this.lod.destroy();
    }

    setLines(start, count, textureSize) {
        this.lineStart = start;
        this.lineCount = count;
        this.viewport.set(0, start, textureSize, count);
    }

    update(updateVersion) {

        // if the object's matrix has changed, store the update version to know when it happened
        const worldMatrix = this.node.getWorldTransform();
        const worldMatrixChanged = !this.previousWorldTransform.equals(worldMatrix);
        if (worldMatrixChanged) {
            this.previousWorldTransform.copy(worldMatrix);
            this.updateVersion = updateVersion;
        }
    }

    render(renderTarget) {
        const { device, resource } = this;
        Debug.assert(resource);

        // set up splat resource properties
        this.material.setParameters(this.device);

        // matrix to transform splats to the world space
        this.device.scope.resolve('uTransform').setValue(this.node.getWorldTransform().data);

        // Set LOD intervals texture for remapping of indices
        device.scope.resolve('uIntervalsTexture').setValue(this.lod.intervalsTexture);

        device.scope.resolve('uActiveSplats').setValue(this.lod.activeSplats);
        device.scope.resolve('uStartLine').setValue(this.lineStart);
        device.scope.resolve('uViewportWidth').setValue(this.viewport.z);

        drawQuadWithShader(device, renderTarget, this.copyShader, this.viewport, this.viewport);
    }
}

export { GSplatInfo };
