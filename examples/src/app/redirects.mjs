/**
 * Examples that moved to another category or were renamed, mapping the old `category/example`
 * path to the current one. Old links keep working: the examples browser redirects these routes,
 * and the build writes iframe, share and thumbnail files under the old names for sites that
 * embed or link to those directly. Keep entries long after a move, as links to the old path live
 * on outside this repository, and repoint them if the example moves again.
 *
 * @type {Record<string, string>}
 */
export const exampleRedirects = {
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
    'graphics/hdr': 'camera-frame/hdr',
    'graphics/light-physical-units': 'lights-and-shadows/light-physical-units',
    'graphics/lights': 'lights-and-shadows/lights',
    'graphics/lights-baked': 'lights-and-shadows/lights-baked',
    'graphics/lights-baked-a-o': 'lights-and-shadows/lights-baked-a-o',
    'graphics/lights-non-clustered': 'lights-and-shadows/lights-non-clustered',
    'graphics/multi-render-targets': 'render-targets/multi-render-targets',
    'graphics/painter': 'render-targets/painter',
    'graphics/post-processing': 'camera-frame/post-processing',
    'graphics/render-pass': 'render-targets/render-pass-camera',
    'graphics/render-to-texture': 'render-targets/render-to-texture',
    'graphics/shadow-cascades': 'lights-and-shadows/shadow-cascades',
    'graphics/shadow-catcher': 'lights-and-shadows/shadow-catcher',
    'graphics/shadow-soft': 'lights-and-shadows/shadow-soft',
    'graphics/taa': 'camera-frame/taa',
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
