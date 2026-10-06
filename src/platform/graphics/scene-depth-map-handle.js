import { Mat4 } from '../../core/math/mat4.js';

/**
 * @import { GraphicsDevice } from './graphics-device.js'
 * @import { Texture } from './texture.js'
 */

/**
 * A handle to the scene depth map of a camera, obtained from
 * {@link CameraComponent#sceneDepthMapHandle}. The handle is a single object for the lifetime of
 * the camera, and always identifies the depth map the camera rendered most recently, together with
 * how it is encoded, even as the camera renders it to a different texture.
 *
 * Pass the handle to {@link Compute#setSceneDepthMap} to make the depth map available to a compute
 * shader.
 *
 * @hideconstructor
 * @category Graphics
 */
class SceneDepthMapHandle {
    /**
     * The name of the global uniform the scene depth map is published to, for the shaders sampling
     * it.
     *
     * @type {string}
     * @ignore
     */
    static uniformName = 'uSceneDepthMap';

    /**
     * Sets the global uniform the scene depth map is published to. The uniform is shared by all
     * cameras, so it holds whichever depth map was published last.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Texture|null} texture - The depth map texture, or null to clear the uniform.
     * @ignore
     */
    static setUniform(device, texture) {
        device.scope.resolve(SceneDepthMapHandle.uniformName).setValue(texture);
    }

    /**
     * The texture the depth map was rendered to most recently, or null when the camera has not
     * rendered one.
     *
     * @type {Texture|null}
     * @ignore
     */
    texture = null;

    /**
     * The render version the depth map was rendered in, so a consumer can tell a depth map rendered
     * this frame from one left over from an earlier frame.
     *
     * @type {number}
     * @ignore
     */
    renderVersion = -1;

    /**
     * True when the texture stores the linear camera depth, false when it stores the depth buffer
     * values, which a consumer linearizes using {@link SceneDepthMapHandle#cameraParams}.
     *
     * @type {boolean}
     * @ignore
     */
    linear = false;

    /**
     * True when each linear depth is stored as a float bit-packed into an RGBA8 texel, the encoding
     * used when float textures cannot be rendered to. Only set together with
     * {@link SceneDepthMapHandle#linear}.
     *
     * @type {boolean}
     * @ignore
     */
    packed = false;

    /**
     * True when the texture stores a coverage weighted average of the reciprocals of the linear
     * depths, which a consumer inverts to recover the depth. Only set together with
     * {@link SceneDepthMapHandle#linear}.
     *
     * @type {boolean}
     * @ignore
     */
    reciprocal = false;

    /**
     * The camera parameters the depth map was rendered with, laid out as 1 / far clip, far clip,
     * near clip and 1 for an orthographic projection or 0 for a perspective one. These are captured
     * when the depth map is rendered, so a consumer decodes it correctly even after the camera
     * changes.
     *
     * @type {Float32Array}
     * @ignore
     */
    cameraParams = new Float32Array(4);

    /**
     * The inverse of the view projection matrix the depth map was rendered with, the one the
     * shaders were given including any jitter, so a consumer can reconstruct the world position of
     * a texel even after the camera moves.
     *
     * @type {Mat4}
     * @ignore
     */
    viewProjectionInverse = new Mat4();

    /**
     * The viewport the camera rendered the depth map with, in texels of the depth map as a compute
     * shader addresses them: the x and y of its first texel, and its width and height. Outside of
     * it, the depth map holds what the camera did not render, such as the views of other cameras
     * rendering to the same target.
     *
     * @type {Uint32Array}
     * @ignore
     */
    viewport = new Uint32Array(4);

    /**
     * True once the camera the handle belongs to has been destroyed.
     *
     * @type {boolean}
     * @ignore
     */
    destroyed = false;
}

export { SceneDepthMapHandle };
