/**
 * Examples that moved to another category or were renamed, mapping the old `category/example`
 * path to the current one, and removed examples, mapping their path to the most similar example.
 * Old links keep working: the examples browser redirects these routes, and the build writes
 * iframe, share and thumbnail files under the old names for sites that embed or link to those
 * directly. Keep entries long after a move, as links to the old path live on outside this
 * repository, and repoint them if the example moves again.
 *
 * @type {Record<string, string>}
 */
export const exampleRedirects = {
    'debug/entity-inspector': 'debug/inspector',
    'gaussian-splatting-fx/crop': 'gaussian-splatting-fx/cropping',
    'gaussian-splatting/black-hole': 'gaussian-splatting-fx/black-hole',
    'gaussian-splatting/clipping': 'gaussian-splatting-fx/clipping',
    'gaussian-splatting/crop': 'gaussian-splatting-fx/cropping',
    'gaussian-splatting/depth-effects': 'gaussian-splatting-fx/depth-effects',
    'gaussian-splatting/depth-of-field': 'gaussian-splatting-fx/depth-of-field',
    'gaussian-splatting/glass-refraction': 'gaussian-splatting-fx/glass-refraction',
    'gaussian-splatting/lod-instances': 'gaussian-splatting/streamed-instances',
    'gaussian-splatting/lod-streaming': 'gaussian-splatting/streamed-sog',
    'gaussian-splatting/lod-streaming-sh': 'gaussian-splatting/streamed-sog-sh',
    'gaussian-splatting/lut-grading': 'gaussian-splatting-fx/color-grading',
    'gaussian-splatting/paint': 'gaussian-splatting-fx/paint',
    'gaussian-splatting/particle-blast': 'gaussian-splatting-fx/particle-blast',
    'gaussian-splatting/procedural-instanced': 'gaussian-splatting-fx/procedural-instanced',
    'gaussian-splatting/procedural-mesh': 'gaussian-splatting-fx/procedural-mesh',
    'gaussian-splatting/procedural-shapes': 'gaussian-splatting-fx/procedural-shapes',
    'gaussian-splatting/relighting': 'gaussian-splatting-fx/relighting',
    'gaussian-splatting/reveal': 'gaussian-splatting-fx/reveal',
    'gaussian-splatting/shader-dissolve': 'gaussian-splatting-fx/shader-dissolve',
    'gaussian-splatting/shader-effects': 'gaussian-splatting-fx/shader-effects',
    'gaussian-splatting/shader-rings': 'gaussian-splatting-fx/shader-rings',
    'gaussian-splatting/shadow-soft': 'gaussian-splatting-fx/shadow-soft',
    'gaussian-splatting/shadows': 'gaussian-splatting-fx/shadows',
    'gaussian-splatting/spherical-harmonics': 'gaussian-splatting/simple-sh',
    'gaussian-splatting/splat-portal': 'gaussian-splatting-fx/portal',
    'gaussian-splatting/weather': 'gaussian-splatting-fx/weather',
    'gaussian-splatting/wind': 'gaussian-splatting-fx/wind',
    'graphics-advanced/custom-msaa-resolve': 'render-targets/custom-msaa-resolve',
    'graphics-advanced/msaa-depth-fog': 'render-targets/msaa-depth-fog',
    'graphics/ambient-occlusion': 'camera-frame/ambient-occlusion',
    'graphics/area-lights': 'lights-and-shadows/area-lights',
    'graphics/clustered-area-lights': 'lights-and-shadows/clustered-area-lights',
    'graphics/clustered-light-cookies': 'lights-and-shadows/clustered-light-cookies',
    'graphics/clustered-lighting': 'lights-and-shadows/clustered-lighting',
    'graphics/clustered-omni-shadows': 'lights-and-shadows/clustered-omni-shadows',
    'graphics/clustered-spot-shadows': 'lights-and-shadows/clustered-spot-shadows',
    'graphics/custom-compose-shader': 'camera-frame/custom-compose-shader',
    'graphics/depth-of-field': 'camera-frame/depth-of-field',
    'graphics/grid': 'debug/grid',
    'graphics/hdr': 'camera-frame/hdr',
    'graphics/layers': 'graphics-advanced/layers',
    'graphics/light-physical-units': 'lights-and-shadows/light-physical-units',
    'graphics/lights': 'lights-and-shadows/lights',
    'graphics/lights-baked': 'lights-and-shadows/lights-baked',
    'graphics/lights-baked-a-o': 'lights-and-shadows/lights-baked-a-o',
    'graphics/lights-non-clustered': 'lights-and-shadows/lights-non-clustered',
    'graphics/model-outline': 'graphics/outlines-colored',
    'graphics/multi-draw': 'graphics-advanced/multi-draw',
    'graphics/multi-draw-instanced': 'graphics-advanced/multi-draw-instanced',
    'graphics/multi-draw-instanced-multi-platform': 'graphics-advanced/multi-draw-instanced-multi-platform',
    'graphics/multi-render-targets': 'render-targets/multi-render-targets',
    'graphics/painter': 'render-targets/painter',
    'graphics/particles-anim-index': 'particles/anim-index',
    'graphics/particles-mesh': 'particles/mesh',
    'graphics/particles-random-sprites': 'particles/random-sprites',
    'graphics/particles-snow': 'particles/snow',
    'graphics/particles-spark': 'particles/spark',
    'graphics/portal': 'graphics-advanced/portal',
    'graphics/post-effects': 'camera-frame/post-processing',
    'graphics/post-processing': 'camera-frame/post-processing',
    'graphics/render-pass': 'render-targets/render-pass-camera',
    'graphics/render-to-texture': 'render-targets/render-to-texture',
    'graphics/shadow-cascades': 'lights-and-shadows/shadow-cascades',
    'graphics/shadow-catcher': 'lights-and-shadows/shadow-catcher',
    'graphics/shadow-soft': 'lights-and-shadows/shadow-soft',
    'graphics/taa': 'camera-frame/taa',
    'graphics/transform-feedback': 'graphics-advanced/transform-feedback',
    'graphics/transform-feedback-separate': 'graphics-advanced/transform-feedback-separate',
    'graphics/volumetric-fog': 'camera-frame/volumetric-fog',
    'graphics/volumetric-fog-local-lights': 'camera-frame/volumetric-fog-local-lights',
    'graphics/volumetric-fog-shafts': 'camera-frame/volumetric-fog-shafts',
    'loaders/loaders-gl': 'integrations/loaders-gl',
    'misc/spineboy': 'integrations/spine',
    'render-targets/render-pass': 'render-targets/render-pass-camera',
    'shaders/integer-textures': 'render-targets/integer-textures',
    'shaders/paint-mesh': 'render-targets/paint-mesh'
};

/**
 * @param {string} path - Route path, e.g. `/graphics/hdr`.
 * @returns {string} The path the example now lives at, or the path itself if it did not move.
 */
export const redirectPath = (path) => {
    const from = path.replace(/^\/|\/$/g, '');
    return Object.hasOwn(exampleRedirects, from) ? `/${exampleRedirects[from]}` : path;
};
