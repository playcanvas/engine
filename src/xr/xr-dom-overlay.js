/**
 * @class
 * @name pc.XrDomOverlay
 * @classdesc DOM Overlay provides ability to use DOM elements as overlay in WebXR AR session. It requires that root DOM element is provided for session start. That way input source select events, first are tested against DOM Elements first, and then propagated down to XR Session. If this propagation is not desirable, use `beforexrselect` event on DOM element, and `preventDefault` function to stop propagation.
 * @description DOM Overlay provides ability to use DOM elements as overlay in WebXR AR session. It requires that root DOM element is provided for session start. That way input source select events, first are tested against DOM Elements first, and then propagated down to XR Session. If this propagation is not desirable, use `beforexrselect` event on DOM element, and `preventDefault` function to stop propagation.
 * @param {pc.XrManager} manager - WebXR Manager.
 * @property {boolean} supported True if DOM Overlay is supported.
 * @property {boolean} available True if DOM Overlay is available. It can only be available if it is supported, during valid WebXR session and if valid root element is provided.
 * @property {string|null} state State of the DOM Overlay, which defines how root DOM element is rendered. Possible options:
 *
 * * screen: Screen - this type indicates that DOM element is covering whole physical screen, mathcing XR viewports.
 * * floating: Floating - indicates that underlying platform renders DOM element as floating in space, which can move during WebXR session or allow developer to move element.
 * * head-locked: Head Locked - indicates that DOM element follows the user’s head movement consistently, appearing similar to a helmet heads-up display.
 *
 * @example
 * app.xr.domOverlay.root = element;
 * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR);
 * @example
 * // disable input source firing `select` event when some descendant element of DOM overlay root is touched/clicked. This is usefull when user interacts with UI elements, and there should not be `select` events behind UI.
 * someElement.addEventListener('beforexrselect', function (evt) {
 *     evt.preventDefault();
 * });
 */
function XrDomOverlay(manager) {
    this._manager = manager;
    this._supported = !! window.XRDOMOverlayState;
    this._root = null;
}

Object.defineProperty(XrDomOverlay.prototype, 'supported', {
    get: function () {
        return this._supported;
    }
});

Object.defineProperty(XrDomOverlay.prototype, 'available', {
    get: function () {
        return this._supported && this._manager.active && this._manager._session.domOverlayState !== null;
    }
});

Object.defineProperty(XrDomOverlay.prototype, 'state', {
    get: function () {
        if (! this._supported || ! this._manager.active || ! this._manager._session.domOverlayState)
            return null;

        return this._manager._session.domOverlayState.type;
    }
});

/**
 * @name pc.XrDomOverlay#root
 * @type {object|null}
 * @description DOM element to be used as root for DOM Overlay. Can be changed only outside of active WebXR session.
 * @example
 * app.xr.domOverlay.root = element;
 * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR);
 */
Object.defineProperty(XrDomOverlay.prototype, 'root', {
    set: function (value) {
        if (! this._supported || this._manager.active)
            return;

        this._root = value;
    },
    get: function () {
        return this._root;
    }
});

export { XrDomOverlay };
