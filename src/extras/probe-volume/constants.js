/**
 * The lighting of the probes is computed from the geometry the probes captured, see
 * {@link ProbeVolumeBaker#captureGeometry}, lit by the lighting of the engine without rendering
 * the scene again. Fast, so suited to baking the lighting again after it changed.
 *
 * @category Graphics
 */
export const PROBESOURCE_GBUFFER = 'gbuffer';

/**
 * The lighting of the probes is computed by rendering the lit scene from each probe. Slower, and
 * includes the reflections of the materials, which depend on the view.
 *
 * @category Graphics
 */
export const PROBESOURCE_SCENE = 'scene';
