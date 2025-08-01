import { Debug } from '../../../core/debug.js';
import { SEMANTIC_POSITION } from '../../../platform/graphics/constants.js';
import { drawQuadWithShader } from '../../graphics/quad-render-utils.js';
import { ShaderMaterial } from '../../materials/shader-material.js';
import { ShaderUtils } from '../../shader-lib/shader-utils.js';
import { GSplatState } from './gspat-state.js';
import glslGsplatCopyToWorkBufferPS from '../../shader-lib/glsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import wgslGsplatCopyToWorkBufferPS from '../../shader-lib/wgsl/chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Vec3 } from '../../../core/math/vec3.js';

/**
 * @import { GraphNode } from "../../graph-node.js";
 * @import { GraphicsDevice } from "../../../platform/graphics/graphics-device.js";
 * @import { GSplatResource } from "../gsplat-resource.js"
 */

const _viewMat = new Mat4();

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

    /**
     * The state of the splat currently used for rendering. This matches the work buffer.
     *
     * @type {GSplatState}
     */
    renderState;

    /**
     * The state of the splat currently used for sorting. When the sorting is done, this state will
     * become the render state. This is where the next render state is prepared, but it's not used
     * until we get back the sorting data.
     *
     * @type {GSplatState|null}
     */
    prepareState = null;

    /** @type {GSplatState|null} */
    unusedState = null;

    /** @type {Mat4} */
    previousWorldTransform = new Mat4();

    /** @type {Vec3} */
    previousPosition = new Vec3();

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
        this.renderState = new GSplatState(device, resource, node);
        this.unusedState = new GSplatState(device, resource, node);

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
        this.renderState?.destroy();
        this.renderState = null;
        this.prepareState?.destroy();
        this.prepareState = null;
        this.unusedState?.destroy();
        this.unusedState = null;
    }

    activatePrepareState() {

        Debug.assert(this.renderState);
        Debug.assert(this.prepareState);

        // no longer using render state, keep it for the future
        this.unusedState = this.renderState;

        // prepared state is now used for rendering
        this.renderState = this.prepareState;

        // done preparing
        // TODO: can we release some data here
        this.prepareState = null;
    }

    startPrepareState(cameraNode) {

        // swap states
        Debug.assert(this.prepareState === null);
        this.prepareState = this.unusedState;
        Debug.assert(this.prepareState);
        this.unusedState = null;

        // this updates LOD intervals and interval texture
        this.prepareState.update(cameraNode);
    }

    cancelPrepareState() {
        if (this.prepareState) {
            this.unusedState = this.prepareState;
            this.prepareState = null;
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

        // if position has moved by more than 1 meter, mark lod dirty
        const position = this.node.getPosition();
        const length = position.distance(this.previousPosition);
        if (length > 1) {
            this.previousPosition.copy(position);
        }

        // return true if position has moved by more than 1 meter, which requires LOD to be re-calculated
        return length > 1;
    }

    render(renderTarget, cameraNode) {
        const { device, resource } = this;
        const scope = device.scope;
        Debug.assert(resource);

        // render using render state
        const { activeSplats, lineStart, viewport, intervalTexture } = this.renderState;

        // assign material properties to scope
        this.material.setParameters(this.device);

        // matrix to transform splats to the world space
        scope.resolve('uTransform').setValue(this.node.getWorldTransform().data);

        if (resource.hasLod) {
            // Set LOD intervals texture for remapping of indices
            scope.resolve('uIntervalsTexture').setValue(intervalTexture.texture);
        }

        scope.resolve('uActiveSplats').setValue(activeSplats);
        scope.resolve('uStartLine').setValue(lineStart);
        scope.resolve('uViewportWidth').setValue(viewport.z);

        // SH related
        scope.resolve('matrix_model').setValue(this.node.getWorldTransform().data);

        const viewInvMat = cameraNode.getWorldTransform();
        const viewMat = _viewMat.copy(viewInvMat).invert();
        scope.resolve('matrix_view').setValue(viewMat.data);

        drawQuadWithShader(device, renderTarget, this.copyShader, viewport, viewport);
    }
}

export { GSplatInfo };
