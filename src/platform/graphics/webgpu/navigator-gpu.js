/**
 * Gets the WebGPU entry point for the browsing context that owns the canvas.
 *
 * A GPU device used to configure a canvas must be created by the canvas's owning context. In
 * WebKit, configuring a canvas with a device from another context terminates the page instead of
 * throwing, which also prevents fallback to WebGL2. If the canvas has an associated window, this
 * deliberately returns that window's `navigator.gpu` even when it is undefined.
 *
 * Canvases without an associated window, such as those created using `createHTMLDocument()` or
 * supplied by a headless host, use the current window's WebGPU entry point.
 *
 * @param {HTMLCanvasElement} canvas - The canvas the device will draw to.
 * @returns {GPU|undefined} The WebGPU entry point to use for the canvas, if available.
 */
const getCanvasNavigatorGpu = (canvas) => {
    const view = canvas?.ownerDocument?.defaultView;
    if (view) {
        return view.navigator?.gpu;
    }
    return window.navigator?.gpu;
};

export { getCanvasNavigatorGpu };
