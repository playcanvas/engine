/**
 * SSAO is disabled.
 *
 * @category Graphics
 */
export const SSAOTYPE_NONE = 'none';

/**
 * SSAO is applied during the lighting calculation stage, allowing it to blend seamlessly with scene
 * lighting. This results in ambient occlusion being more pronounced in areas where direct light is
 * obstructed, enhancing realism.
 *
 * @category Graphics
 */
export const SSAOTYPE_LIGHTING = 'lighting';

/**
 * SSAO is applied as a standalone effect after the scene is rendered. This method uniformly
 * overlays ambient occlusion across the image, disregarding direct lighting interactions. While
 * this may sacrifice some realism, it can be advantageous for achieving specific artistic styles.
 *
 * @category Graphics
 */
export const SSAOTYPE_COMBINE = 'combine';

/**
 * Compose slot applied to the scene colour immediately after it is sampled, before any other
 * composition. Effects here receive and return the full `vec4` including alpha, and may take
 * multiple taps of the scene texture.
 *
 * @category Graphics
 */
export const COMPOSESLOT_SCENE = 'scene';

/**
 * Compose slot applied in linear, scene-referred HDR space, before tone mapping.
 *
 * @category Graphics
 */
export const COMPOSESLOT_HDR = 'hdr';

/**
 * Compose slot applied in display-referred LDR space, after tone mapping and before gamma
 * correction.
 *
 * @category Graphics
 */
export const COMPOSESLOT_LDR = 'ldr';

/**
 * Compose slot applied after gamma correction, on the final output values.
 *
 * @category Graphics
 */
export const COMPOSESLOT_OUTPUT = 'output';

/**
 * The compose slots, in the order they are applied.
 *
 * @type {string[]}
 * @ignore
 */
export const composeSlots = [COMPOSESLOT_SCENE, COMPOSESLOT_HDR, COMPOSESLOT_LDR, COMPOSESLOT_OUTPUT];

/**
 * A frame resource: the depth of the scene, available once the opaque geometry has rendered. List
 * it in {@link CameraFrameEffect#requires} to read the depth in the effect's shaders, using the
 * `getLinearScreenDepth` function of the `screenDepthPS` chunk, which the composition includes for
 * the effect's compose chunk. The camera frame renders the depth the cheapest way available. Passes
 * running between the opaque and the transparent geometry read the depth of the opaque geometry.
 *
 * @type {string}
 * @category Graphics
 */
export const FRAMERESOURCE_DEPTH = 'depth';

/**
 * A frame resource: the depth of the scene, rendered by a prepass before the scene, so that it is
 * also available to passes running before the scene and while it renders. List it in
 * {@link CameraFrameEffect#requires} instead of {@link FRAMERESOURCE_DEPTH} when the depth is
 * needed that early. The prepass renders the opaque geometry an additional time.
 *
 * @type {string}
 * @category Graphics
 */
export const FRAMERESOURCE_PREPASSDEPTH = 'prepassDepth';

/**
 * A frame resource: the scene color at half resolution, for the effect's passes to read. It is a
 * box filtered copy of the scene color, taken after temporal anti-aliasing when it is enabled. It
 * stays the same texture for the life of the passes, and is resized with the scene.
 *
 * @type {string}
 * @category Graphics
 */
export const FRAMERESOURCE_SCENECOLORHALF = 'sceneColorHalf';

/**
 * A frame resource: a copy of the scene color with mipmaps, taken after the opaque geometry and the
 * skybox have rendered, before the transparent geometry. List it in
 * {@link CameraFrameEffect#requires} to read the opaque scene in the effect's shaders, which sample
 * it as the `uSceneColorMap` texture - for example to distort it while rendering into the scene
 * between its opaque and transparent geometry. It is the copy the `rendering.sceneColorMap` option
 * of the camera frame provides to the materials, which requiring it enables.
 *
 * @type {string}
 * @category Graphics
 */
export const FRAMERESOURCE_SCENECOLORGRAB = 'sceneColorGrab';

/**
 * A frame resource: the render target the scene renders to, for passes rendering into the scene
 * before its temporal anti-aliasing, such as volumetric fog.
 *
 * @type {string}
 * @category Graphics
 */
export const FRAMERESOURCE_SCENETARGET = 'sceneTarget';

/**
 * The sky of the {@link DynamicSkyEffect} has no clouds.
 *
 * @category Graphics
 */
export const CLOUDTYPE_NONE = 'none';

/**
 * The clouds of the {@link DynamicSkyEffect} are a single flat layer of noise with simple shading,
 * reading a single texture per pixel - for low end devices.
 *
 * @category Graphics
 */
export const CLOUDTYPE_FLAT = 'flat';

/**
 * The clouds of the {@link DynamicSkyEffect} are ray marched through a layer of 3D noise, each step
 * in a cloud lit by a short march toward the light, at the cost set by
 * {@link DynamicSkyEffect#cloudQuality}. They can render at a reduced resolution, see
 * {@link DynamicSkyEffect#cloudResolution}.
 *
 * @category Graphics
 */
export const CLOUDTYPE_VOLUMETRIC = 'volumetric';
