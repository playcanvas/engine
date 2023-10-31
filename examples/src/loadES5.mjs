/**
 * @example
 * const CORE = await load('https://cdn.jsdelivr.net/npm/@loaders.gl/core@2.3.6/dist/dist.min.js');
 * const DRACO = await load('https://cdn.jsdelivr.net/npm/@loaders.gl/draco@2.3.6/dist/dist.min.js');
 * @param {string} url - The URL to ES5 file.
 */
export async function loadES5(url) {
    const res = await fetch(url);
    const txt = await res.text();
    const module = {
        exports: {}
    };
    return (Function('module', 'exports', txt).call(module, module, module.exports), module).exports;
}
