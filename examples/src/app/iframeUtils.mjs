export function iframeRequestFiles() {
    const exampleIframe = document.getElementById('exampleIframe');
    exampleIframe.contentWindow.dispatchEvent(new CustomEvent("requestFiles"));
}
export function iframeShowStats() {
    const exampleIframe = document.getElementById('exampleIframe');
    exampleIframe.contentWindow.dispatchEvent(new CustomEvent("showStats"));
}
export function iframeHideStats() {
    const exampleIframe = document.getElementById('exampleIframe');
    exampleIframe.contentWindow.dispatchEvent(new CustomEvent("hideStats"));
}
