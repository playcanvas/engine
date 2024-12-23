/**
 * A rollup plugin that filters out modules from treeshaking
 *
 * @param {RegExp[]} pathRegexList - A list of regexes to match against module paths
 * @returns {import('rollup').Plugin} The rollup plugin
 */
export function treeshakeIgnore(pathRegexList = []) {
    return {
        name: 'treeshake-ignore',
        transform(code, id) {
            if (pathRegexList.some(regex => regex.test(id.replace(/\\/g, '/')))) {
                return {
                    code,
                    map: null,
                    moduleSideEffects: 'no-treeshake'
                };
            }

            return {
                code,
                map: null
            };
        }
    };
}
