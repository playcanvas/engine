// The PlayCanvas Examples browser basically comes in two parts: React and PlayCanvas code:
// 1) We don't want to load UI/React code in the <iframe>
// 2) We don't want to load PlayCanvas code in Examples browser
// Because:
// 1) This keeps the file sizes as minimal as possible.
// 2) this keeps the build/rebuild times as short as possible.
// 3) Separation of Concerns: Don't mix up UI/PC.
// 4) Reducing mental overhead: everything becomes easier to debug/argue-about.
/**
 * @throws {string} In case the <iframe> is missing.
 * @returns {Window|null} The example window.
 */
function getIframeWindow() {
    const e = document.getElementById('exampleIframe');
    // Never simply cast getElementById, it's important to properly check and
    // handle the returned element, as it is possible for the element to:
    // 1) Not exist.
    // 2) Have a different type than expected.
    // These situations happen during refactoring etc.
    if (!(e instanceof HTMLIFrameElement)) {
        console.warn("'exampleIframe' doesn't exist yet.");
        return null;
    }
    return e.contentWindow;
}
function iframeReady() {
    try {
        // @ts-ignore
        return getIframeWindow()?.eval('ready === true');
    } catch (e) {}
    return false;
}
function iframeReload() {
    getIframeWindow()?.location.reload();
}
/**
 * @param {string} eventName - The event name
 */
function iframeFire(eventName) {
    getIframeWindow()?.dispatchEvent(new CustomEvent(eventName));
}

export {
    getIframeWindow,
    iframeReady,
    iframeReload,
    iframeFire
};
