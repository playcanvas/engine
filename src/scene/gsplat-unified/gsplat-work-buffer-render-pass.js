import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';

/**
 * @import { GSplatInfo } from './gsplat-info.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { RenderTarget } from '../../platform/graphics/render-target.js'
 */

const _viewMat = new Mat4();

const _lodColors = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [1, 0, 1]
];

// enable to colorize LODs
const colorizeLod = false;

/**
 * A render pass used to render multiple gsplats to a work buffer render target.
 *
 * @ignore
 */
class GSplatWorkBufferRenderPass extends RenderPass {
    /**
     * Array of GSplatInfo objects to render in this pass.
     *
     * @type {GSplatInfo[]}
     */
    splats = [];

    /**
     * The camera node used for rendering.
     *
     * @type {GraphNode}
     */
    cameraNode;

    /**
     * Initialize the render pass with the specified render target.
     *
     * @param {RenderTarget} renderTarget - The target to render to.
     */
    init(renderTarget) {
        super.init(renderTarget);
        this.colorOps.clear = false;
        this.depthStencilOps.clearDepth = false;
    }

    /**
     * Update the render pass with splats to render and camera.
     *
     * @param {GSplatInfo[]} splats - Array of GSplatInfo objects to render.
     * @param {GraphNode} cameraNode - The camera node for rendering.
     * @returns {boolean} True if there are splats to render, false otherwise.
     */
    update(splats, cameraNode) {
        this.splats.length = 0;

        // Filter active splats that need rendering
        for (let i = 0; i < splats.length; i++) {
            const splatInfo = splats[i];
            if (splatInfo.activeSplats > 0) {
                this.splats.push(splatInfo);
            }
        }

        this.cameraNode = cameraNode;
        return this.splats.length > 0;
    }

    execute() {
        const { device, splats, cameraNode } = this;

        DebugGraphics.pushGpuMarker(device, 'GSplatWorkBuffer');

        // view matrix
        const viewInvMat = cameraNode.getWorldTransform();
        const viewMat = _viewMat.copy(viewInvMat).invert();
        device.scope.resolve('matrix_view').setValue(viewMat.data);

        // render each splat info
        for (let i = 0; i < splats.length; i++) {
            this.renderSplat(splats[i]);
        }

        DebugGraphics.popGpuMarker(device);
    }

    /**
     * Render a single splat info object.
     *
     * @param {GSplatInfo} splatInfo - The splat info to render.
     */
    renderSplat(splatInfo) {
        const { device, resource } = splatInfo;
        const scope = device.scope;
        Debug.assert(resource);

        const { intervals, activeSplats, lineStart, viewport, intervalTexture } = splatInfo;

        // quad renderer and material are cached in the resource
        const workBufferRenderInfo = resource.getWorkBufferRenderInfo(intervals.length > 0, colorizeLod);

        // Assign material properties to scope
        workBufferRenderInfo.material.setParameters(device);

        // Matrix to transform splats to the world space
        scope.resolve('uTransform').setValue(splatInfo.node.getWorldTransform().data);

        if (intervalTexture.texture) {
            // Set LOD intervals texture for remapping of indices
            scope.resolve('uIntervalsTexture').setValue(intervalTexture.texture);
        }

        scope.resolve('uActiveSplats').setValue(activeSplats);
        scope.resolve('uStartLine').setValue(lineStart);
        scope.resolve('uViewportWidth').setValue(viewport.z);

        if (colorizeLod) {
            scope.resolve('uLodColor').setValue(_lodColors[splatInfo.lodIndex]);
        }

        // SH related
        scope.resolve('matrix_model').setValue(splatInfo.node.getWorldTransform().data);

        // Render the quad - QuadRender handles all the complex setup internally
        workBufferRenderInfo.quadRender.render(viewport);
    }

    destroy() {
        this.splats.length = 0;
        super.destroy();
    }
}

export { GSplatWorkBufferRenderPass };
