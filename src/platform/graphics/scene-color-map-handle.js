/**
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { Texture } from './texture.js'
 */

/**
 * A handle to the scene color map of a camera, obtained from
 * {@link CameraComponent#sceneColorMapHandle}. The handle is a single object for the lifetime of
 * the camera, and always identifies the color map the camera rendered most recently, together with
 * how it is encoded, even as the camera renders it to a different texture.
 *
 * Pass the handle to {@link Compute#setSceneColorMap} to make the color map available to a compute
 * shader.
 *
 * @hideconstructor
 * @category Graphics
 */
class SceneColorMapHandle {
    /**
     * The name of the global uniform the scene color map is published to, for the shaders sampling
     * it.
     *
     * @type {string}
     * @ignore
     */
    static uniformName = 'uSceneColorMap';

    /**
     * Sets the global uniform the scene color map is published to. The uniform is shared by all
     * cameras, so it holds whichever color map was published last.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Texture|null} texture - The color map texture, or null to clear the uniform.
     * @ignore
     */
    static setUniform(device, texture) {
        device.scope.resolve(SceneColorMapHandle.uniformName).setValue(texture);
    }

    /**
     * The texture the color map was rendered to most recently, or null when the camera has not
     * rendered one.
     *
     * @type {Texture|null}
     * @ignore
     */
    texture = null;

    /**
     * True when the texture stores gamma encoded colors, false when it stores linear colors.
     *
     * @type {boolean}
     * @ignore
     */
    gamma = false;

    /**
     * True once the camera the handle belongs to has been destroyed.
     *
     * @type {boolean}
     * @ignore
     */
    destroyed = false;

    /**
     * Gets the width of the color map the camera rendered most recently, in texels, or 0 when the
     * camera has not rendered one. A compute shader processing each texel of the color map is
     * dispatched over this size, see {@link Compute#setupDispatchThreads}. It changes with the
     * color map, so read it right before the dispatch: once the camera renders in the frame, it is
     * the width of the color map of this frame, and before that, of the previous frame.
     *
     * @type {number}
     */
    get width() {
        return this.texture?.width ?? 0;
    }

    /**
     * Gets the height of the color map the camera rendered most recently, in texels, or 0 when the
     * camera has not rendered one. See {@link SceneColorMapHandle#width}.
     *
     * @type {number}
     */
    get height() {
        return this.texture?.height ?? 0;
    }
}

export { SceneColorMapHandle };
