/**
 * @throws {string} In case the <iframe> is missing.
 * @returns {Window} The example window.
 */
function getIframeWindow() {
    const e = document.getElementById('exampleIframe');
    // Never simply cast getElementById, it's important to properly check and
    // handle the returned element, as it is possible for the element to:
    // 1) Not exist.
    // 2) Have a different type than expected.
    // These situations happen during refactoring etc.
    if (!(e instanceof HTMLIFrameElement)) {
        throw 'Missing <iframe> with id exampleIframe';
    }
    return e.contentWindow;
}
function iframeRequestFiles() {
    getIframeWindow().dispatchEvent(new CustomEvent('requestFiles'));
}
function iframeShowStats() {
    getIframeWindow().dispatchEvent(new CustomEvent('showStats'));
}
function iframeHideStats() {
    getIframeWindow().dispatchEvent(new CustomEvent('hideStats'));
}
function iframeResize() {
    getIframeWindow().dispatchEvent(new Event('resize'));
}
function iframeReload() {
    getIframeWindow().location.reload();
}
/**
 * Instead of reloading the entire iframe, we simply reevaluate the example function.
 * This makes the hot reload nearly instant, while iframeReload() can take seconds.
 * Only drawback is App#destroy is sometimes buggy - hence hot-reload is only configured
 * on Shift+Enter, while the CodeEditor reload button is calling iframeReload().
 */
function iframeHotReload() {
    getIframeWindow().dispatchEvent(new Event('hotReload'));
}
export {
    iframeRequestFiles,
    iframeShowStats,
    iframeHideStats,
    iframeResize,
    iframeReload,
    iframeHotReload,
};
