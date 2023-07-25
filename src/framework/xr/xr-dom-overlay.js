import { platform } from '../../core/platform.js';

/**
 * DOM Overlay provides the ability to use DOM elements as an overlay in a WebXR AR session. It
 * requires that the root DOM element is provided for session start. That way, input source select
 * events are first tested against DOM Elements and then propagated down to the XR Session. If this
 * propagation is not desirable, use the `beforexrselect` event on a DOM element and the
 * `preventDefault` function to stop propagation.
 *
 * ```javascript
 * app.xr.domOverlay.root = element;
 * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR);
 * ```
 *
 * ```javascript
 * // Disable input source firing `select` event when some descendant element of DOM overlay root
 * // is touched/clicked. This is useful when the user interacts with UI elements and there should
 * // not be `select` events behind UI.
 * someElement.addEventListener('beforexrselect', function (evt) {
 *     evt.preventDefault();
 * });
 * ```
 *
 * @category XR
 */
class XrDomOverlay {
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    _manager;

    /**
     * @type {boolean}
     * @private
     */
    _supported = platform.browser && !!window.XRDOMOverlayState;

    /**
     * @type {Element|null}
     * @private
     */
    _root = null;

    /**
     * DOM Overlay provides the ability to use DOM elements as an overlay in a WebXR AR session. It
     * requires that the root DOM element is provided for session start. That way, input source
     * select events are first tested against DOM Elements and then propagated down to the XR
     * Session. If this propagation is not desirable, use the `beforexrselect` event on a DOM
     * element and the `preventDefault` function to stop propagation.
     *
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @hideconstructor
     */
    constructor(manager) {
        this._manager = manager;
    }

    /**
     * True if DOM Overlay is supported.
     *
     * @type {boolean}
     */
    get supported() {
        return this._supported;
    }

    /**
     * True if DOM Overlay is available. It can only be available if it is supported, during a
     * valid WebXR session and if a valid root element is provided.
     *
     * @type {boolean}
     */
    get available() {
        return this._supported && this._manager.active && this._manager._session.domOverlayState !== null;
    }

    /**
     * State of the DOM Overlay, which defines how the root DOM element is rendered. Possible
     * options:
     *
     * - screen: Screen - indicates that the DOM element is covering whole physical screen,
     * matching XR viewports.
     * - floating: Floating - indicates that the underlying platform renders the DOM element as
     * floating in space, which can move during the WebXR session or allow the application to move
     * the element.
     * - head-locked: Head Locked - indicates that the DOM element follows the user's head movement
     * consistently, appearing similar to a helmet heads-up display.
     *
     * @type {string|null}
     */
    get state() {
        if (!this._supported || !this._manager.active || !this._manager._session.domOverlayState)
            return null;

        return this._manager._session.domOverlayState.type;
    }

    /**
     * The DOM element to be used as the root for DOM Overlay. Can be changed only outside of an
     * active WebXR session.
     *
     * @type {Element|null}
     * @example
     * app.xr.domOverlay.root = element;
     * app.xr.start(camera, pc.XRTYPE_AR, pc.XRSPACE_LOCALFLOOR);
     */
    set root(value) {
        if (!this._supported || this._manager.active)
            return;

        this._root = value;
    }

    get root() {
        return this._root;
    }
}

export { XrDomOverlay };
