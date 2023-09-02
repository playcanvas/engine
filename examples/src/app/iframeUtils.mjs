/**
 * @returns {Window} The example window.
 */
function getIframeWindow() {
    const exampleIframe = document.getElementById('exampleIframe');
    return exampleIframe.contentWindow;
}
function iframeRequestFiles() {
    const exampleWindow = getIframeWindow();
    exampleWindow.dispatchEvent(new CustomEvent("requestFiles"));
}
function iframeShowStats() {
    const exampleWindow = getIframeWindow();
    exampleWindow.dispatchEvent(new CustomEvent("showStats"));
}
function iframeHideStats() {
    const exampleWindow = getIframeWindow();
    exampleWindow.dispatchEvent(new CustomEvent("hideStats"));
}
function iframeResize() {
    const exampleWindow = getIframeWindow();
    exampleWindow.dispatchEvent(new Event("resize"));
}
function iframeReload() {
    const exampleWindow = getIframeWindow();
    exampleWindow.location.reload();
}
export {
    iframeRequestFiles,
    iframeShowStats,
    iframeHideStats,
    iframeResize,
    iframeReload,
};
