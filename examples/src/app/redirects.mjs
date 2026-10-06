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
    'graphics/ambient-occlusion': 'camera-frame/ambient-occlusion',
    'graphics/custom-compose-shader': 'camera-frame/custom-compose-shader',
    'graphics/depth-of-field': 'camera-frame/depth-of-field',
    'graphics/hdr': 'camera-frame/hdr',
    'graphics/post-processing': 'camera-frame/post-processing',
    'graphics/taa': 'camera-frame/taa',
    'graphics/volumetric-fog': 'camera-frame/volumetric-fog',
    'graphics/volumetric-fog-local-lights': 'camera-frame/volumetric-fog-local-lights',
    'graphics/volumetric-fog-shafts': 'camera-frame/volumetric-fog-shafts'
};

/**
 * @param {string} path - Route path, e.g. `/graphics/hdr`.
 * @returns {string} The path the example now lives at, or the path itself if it did not move.
 */
export const redirectPath = (path) => {
    const from = path.replace(/^\/|\/$/g, '');
    return Object.hasOwn(exampleRedirects, from) ? `/${exampleRedirects[from]}` : path;
};
