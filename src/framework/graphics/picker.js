import { Color } from '../../core/math/color.js';

import { ADDRESS_CLAMP_TO_EDGE, CLEARFLAG_DEPTH, FILTER_NEAREST, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';

import { SHADER_PICK, SORTMODE_NONE } from '../../scene/constants.js';
import { Camera } from '../../scene/camera.js';
import { Command } from '../../scene/mesh-instance.js';
import { Layer } from '../../scene/layer.js';
import { LayerComposition } from '../../scene/composition/layer-composition.js';

import { getApplication } from '../globals.js';
import { Entity } from '../entity.js';
import { Debug } from '../../core/debug.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

const tempSet = new Set();

const clearDepthOptions = {
    depth: 1.0,
    flags: CLEARFLAG_DEPTH
};

/**
 * Picker object used to select mesh instances from screen coordinates.
 *
 * @property {number} width Width of the pick buffer in pixels (read-only).
 * @property {number} height Height of the pick buffer in pixels (read-only).
 * @property {RenderTarget} renderTarget The render target used by the picker internally
 * (read-only).
 */
class Picker {
    // internal render target
    renderTarget = null;

    /**
     * Create a new Picker instance.
     *
     * @param {import('../app-base.js').AppBase} app - The application managing this picker
     * instance.
     * @param {number} width - The width of the pick buffer in pixels.
     * @param {number} height - The height of the pick buffer in pixels.
     */
    constructor(app, width, height) {
        if (app instanceof GraphicsDevice) {
            app = getApplication();
            Debug.deprecated('pc.Picker now takes pc.AppBase as first argument. Passing pc.GraphicsDevice is deprecated.');
        }

        this.app = app;
        this.device = app.graphicsDevice;

        // uniform for the mesh index encoded into rgba
        this.pickColor = new Float32Array(4);
        this.pickColor[3] = 1;

        // mapping table from ids to meshInstances
        this.mapping = [];

        // create layer composition with the layer and camera
        this.cameraEntity = null;
        this.layer = null;
        this.layerComp = null;
        this.initLayerComposition();

        // clear command user to simulate layer clearing, required due to storing meshes from multiple layers on a singe layer
        const device = this.device;
        this.clearDepthCommand = new Command(0, 0, function () {
            device.clear(clearDepthOptions);
        });

        this.width = 0;
        this.height = 0;
        this.resize(width, height);
    }

    /**
     * Return the list of mesh instances selected by the specified rectangle in the previously
     * prepared pick buffer.The rectangle using top-left coordinate system.
     *
     * @param {number} x - The left edge of the rectangle.
     * @param {number} y - The top edge of the rectangle.
     * @param {number} [width] - The width of the rectangle.
     * @param {number} [height] - The height of the rectangle.
     * @returns {import('../../scene/mesh-instance.js').MeshInstance[]} An array of mesh instances
     * that are in the selection.
     * @example
     * // Get the selection at the point (10,20)
     * var selection = picker.getSelection(10, 20);
     * @example
     * // Get all models in rectangle with corners at (10,20) and (20,40)
     * var selection = picker.getSelection(10, 20, 10, 20);
     */
    getSelection(x, y, width, height) {
        const device = this.device;

        if (typeof x === 'object') {
            Debug.deprecated('Picker.getSelection:param \'rect\' is deprecated, use \'x, y, width, height\' instead.');

            const rect = x;
            x = rect.x;
            y = rect.y;
            width = rect.width;
            height = rect.height;
        } else {
            y = this.renderTarget.height - (y + (height || 1));
        }

        // make sure we have nice numbers to work with
        x = Math.floor(x);
        y = Math.floor(y);
        width = Math.floor(Math.max(width || 1, 1));
        height = Math.floor(Math.max(height || 1, 1));

        // backup active render target
        const origRenderTarget = device.renderTarget;

        DebugGraphics.pushGpuMarker(device, 'PICKER');

        // Ready the device for rendering to the pick buffer
        device.setRenderTarget(this.renderTarget);
        device.updateBegin();

        const pixels = new Uint8Array(4 * width * height);
        device.readPixels(x, y, width, height, pixels);

        device.updateEnd();

        // Restore render target
        device.setRenderTarget(origRenderTarget);

        DebugGraphics.popGpuMarker(device);

        const mapping = this.mapping;
        for (let i = 0; i < width * height; i++) {
            const r = pixels[4 * i + 0];
            const g = pixels[4 * i + 1];
            const b = pixels[4 * i + 2];
            const index = r << 16 | g << 8 | b;

            // White is 'no selection'
            if (index !== 0xffffff) {
                tempSet.add(mapping[index]);
            }
        }

        // return the content of the set as an array
        const selection = [];
        tempSet.forEach(meshInstance => selection.push(meshInstance));
        tempSet.clear();

        return selection;
    }

    allocateRenderTarget() {

        const colorBuffer = new Texture(this.device, {
            format: PIXELFORMAT_RGBA8,
            width: this.width,
            height: this.height,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            name: 'pick'
        });

        this.renderTarget = new RenderTarget({
            colorBuffer: colorBuffer,
            depth: true
        });
    }

    releaseRenderTarget() {

        // unset it from the camera
        this.cameraEntity.camera.renderTarget = null;

        if (this.renderTarget) {
            this.renderTarget.destroyTextureBuffers();
            this.renderTarget.destroy();
            this.renderTarget = null;
        }
    }

    initLayerComposition() {

        const device = this.device;
        const self = this;
        const pickColorId = device.scope.resolve('uColor');

        // camera
        this.cameraEntity = new Entity();
        this.cameraEntity.addComponent('camera');

        // layer all meshes rendered for picking at added to
        this.layer = new Layer({
            name: 'Picker',
            shaderPass: SHADER_PICK,
            opaqueSortMode: SORTMODE_NONE,

            // executes just before the mesh is rendered. And index encoded in rgb is assigned to it
            onDrawCall: function (meshInstance, index) {
                self.pickColor[0] = ((index >> 16) & 0xff) / 255;
                self.pickColor[1] = ((index >> 8) & 0xff) / 255;
                self.pickColor[2] = (index & 0xff) / 255;
                pickColorId.setValue(self.pickColor);
                device.setBlendState(BlendState.DEFAULT);

                // keep the index -> meshInstance index mapping
                self.mapping[index] = meshInstance;
            }
        });
        this.layer.addCamera(this.cameraEntity.camera);

        // composition
        this.layerComp = new LayerComposition('picker');
        this.layerComp.pushOpaque(this.layer);
    }

    /**
     * Primes the pick buffer with a rendering of the specified models from the point of view of
     * the supplied camera. Once the pick buffer has been prepared, {@link Picker#getSelection} can
     * be called multiple times on the same picker object. Therefore, if the models or camera do
     * not change in any way, {@link Picker#prepare} does not need to be called again.
     *
     * @param {import('../components/camera/component.js').CameraComponent} camera - The camera
     * component used to render the scene.
     * @param {import('../../scene/scene.js').Scene} scene - The scene containing the pickable mesh
     * instances.
     * @param {Layer[]} [layers] - Layers from which objects will be picked. If not supplied, all layers of the specified camera will be used.
     */
    prepare(camera, scene, layers) {

        // handle deprecated arguments
        if (camera instanceof Camera) {
            Debug.deprecated('pc.Picker#prepare now takes pc.CameraComponent as first argument. Passing pc.Camera is deprecated.');

            // Get the camera component
            camera = camera.node.camera;
        }

        if (layers instanceof Layer) {
            layers = [layers];
        }

        // populate the layer with meshes and depth clear commands
        this.layer.clearMeshInstances();
        const destMeshInstances = this.layer.opaqueMeshInstances;

        // source mesh instances
        const srcLayers = scene.layers.layerList;
        const subLayerEnabled = scene.layers.subLayerEnabled;
        const isTransparent = scene.layers.subLayerList;

        for (let i = 0; i < srcLayers.length; i++) {
            const srcLayer = srcLayers[i];

            // skip the layer if it does not match the provided ones
            if (layers && layers.indexOf(srcLayer) < 0) {
                continue;
            }

            if (srcLayer.enabled && subLayerEnabled[i]) {

                // if the layer is rendered by the camera
                const layerCamId = srcLayer.cameras.indexOf(camera);
                if (layerCamId >= 0) {

                    // if the layer clears the depth, add command to clear it
                    if (srcLayer._clearDepthBuffer) {
                        destMeshInstances.push(this.clearDepthCommand);
                    }

                    // copy all pickable mesh instances
                    const meshInstances = isTransparent[i] ? srcLayer.instances.transparentMeshInstances : srcLayer.instances.opaqueMeshInstances;
                    for (let j = 0; j < meshInstances.length; j++) {
                        const meshInstance = meshInstances[j];
                        if (meshInstance.pick) {
                            destMeshInstances.push(meshInstance);
                        }
                    }
                }
            }
        }

        // make the render target the right size
        if (!this.renderTarget || (this.width !== this.renderTarget.width || this.height !== this.renderTarget.height)) {
            this.releaseRenderTarget();
            this.allocateRenderTarget();
        }

        // prepare the rendering camera
        this.updateCamera(camera);

        // clear registered meshes mapping
        this.mapping.length = 0;

        // render
        this.app.renderComposition(this.layerComp);
    }

    updateCamera(srcCamera) {

        // copy transform
        this.cameraEntity.copy(srcCamera.entity);
        this.cameraEntity.name = 'PickerCamera';

        // copy camera component properties - which overwrites few properties we change to what is needed later
        const destCamera = this.cameraEntity.camera;
        destCamera.copy(srcCamera);

        // set up clears
        destCamera.clearColorBuffer = true;
        destCamera.clearDepthBuffer = true;
        destCamera.clearStencilBuffer = true;
        destCamera.clearColor = Color.WHITE;

        // render target
        destCamera.renderTarget = this.renderTarget;

        // layers
        this.layer.clearCameras();
        this.layer.addCamera(destCamera);
        destCamera.layers = [this.layer.id];
    }

    /**
     * Sets the resolution of the pick buffer. The pick buffer resolution does not need to match
     * the resolution of the corresponding frame buffer use for general rendering of the 3D scene.
     * However, the lower the resolution of the pick buffer, the less accurate the selection
     * results returned by {@link Picker#getSelection}. On the other hand, smaller pick buffers
     * will yield greater performance, so there is a trade off.
     *
     * @param {number} width - The width of the pick buffer in pixels.
     * @param {number} height - The height of the pick buffer in pixels.
     */
    resize(width, height) {
        this.width = Math.floor(width);
        this.height = Math.floor(height);
    }
}

export { Picker };
