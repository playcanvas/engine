import { EventHandler } from '../../core/event-handler.js';

import { XrInputSource } from './xr-input-source.js';

/**
 * Provides access to input sources for WebXR.
 *
 * @augments EventHandler
 */
class XrInput extends EventHandler {
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    manager;

    /**
     * @type {XrInputSource[]}
     * @private
     */
    _inputSources = [];

    /**
     * @type {Function}
     * @private
     */
    _onInputSourcesChangeEvt;

    /**
     * Create a new XrInput instance.
     *
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @hideconstructor
     */
    constructor(manager) {
        super();

        this.manager = manager;

        this._onInputSourcesChangeEvt = (evt) => {
            this._onInputSourcesChange(evt);
        };

        this.manager.on('start', this._onSessionStart, this);
        this.manager.on('end', this._onSessionEnd, this);
    }

    /**
     * Fired when new {@link XrInputSource} is added to the list.
     *
     * @event XrInput#add
     * @param {XrInputSource} inputSource - Input source that has been added.
     * @example
     * app.xr.input.on('add', function (inputSource) {
     *     // new input source is added
     * });
     */

    /**
     * Fired when {@link XrInputSource} is removed to the list.
     *
     * @event XrInput#remove
     * @param {XrInputSource} inputSource - Input source that has been removed.
     * @example
     * app.xr.input.on('remove', function (inputSource) {
     *     // input source is removed
     * });
     */

    /**
     * Fired when {@link XrInputSource} has triggered primary action. This could be pressing a
     * trigger button, or touching a screen.
     *
     * @event XrInput#select
     * @param {XrInputSource} inputSource - Input source that triggered select event.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API.
     * @example
     * const ray = new pc.Ray();
     * app.xr.input.on('select', function (inputSource, evt) {
     *     ray.set(inputSource.getOrigin(), inputSource.getDirection());
     *     if (obj.intersectsRay(ray)) {
     *         // selected an object with input source
     *     }
     * });
     */

    /**
     * Fired when {@link XrInputSource} has started to trigger primary action.
     *
     * @event XrInput#selectstart
     * @param {XrInputSource} inputSource - Input source that triggered selectstart event.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API.
     */

    /**
     * Fired when {@link XrInputSource} has ended triggerring primary action.
     *
     * @event XrInput#selectend
     * @param {XrInputSource} inputSource - Input source that triggered selectend event.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API.
     */

    /**
     * Fired when {@link XrInputSource} has triggered squeeze action. This is associated with
     * "grabbing" action on the controllers.
     *
     * @event XrInput#squeeze
     * @param {XrInputSource} inputSource - Input source that triggered squeeze event.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API.
     */

    /**
     * Fired when {@link XrInputSource} has started to trigger sqeeze action.
     *
     * @event XrInput#squeezestart
     * @param {XrInputSource} inputSource - Input source that triggered squeezestart event.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API.
     * @example
     * app.xr.input.on('squeezestart', function (inputSource, evt) {
     *     if (obj.containsPoint(inputSource.getPosition())) {
     *         // grabbed an object
     *     }
     * });
     */

    /**
     * Fired when {@link XrInputSource} has ended triggerring sqeeze action.
     *
     * @event XrInput#squeezeend
     * @param {XrInputSource} inputSource - Input source that triggered squeezeend event.
     * @param {object} evt - XRInputSourceEvent event data from WebXR API.
     */

    /** @private */
    _onSessionStart() {
        const session = this.manager.session;
        session.addEventListener('inputsourceschange', this._onInputSourcesChangeEvt);

        session.addEventListener('select', (evt) => {
            const inputSource = this._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource.fire('select', evt);
            this.fire('select', inputSource, evt);
        });
        session.addEventListener('selectstart', (evt) => {
            const inputSource = this._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource._selecting = true;
            inputSource.fire('selectstart', evt);
            this.fire('selectstart', inputSource, evt);
        });
        session.addEventListener('selectend', (evt) => {
            const inputSource = this._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource._selecting = false;
            inputSource.fire('selectend', evt);
            this.fire('selectend', inputSource, evt);
        });

        session.addEventListener('squeeze', (evt) => {
            const inputSource = this._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource.fire('squeeze', evt);
            this.fire('squeeze', inputSource, evt);
        });
        session.addEventListener('squeezestart', (evt) => {
            const inputSource = this._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource._squeezing = true;
            inputSource.fire('squeezestart', evt);
            this.fire('squeezestart', inputSource, evt);
        });
        session.addEventListener('squeezeend', (evt) => {
            const inputSource = this._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource._squeezing = false;
            inputSource.fire('squeezeend', evt);
            this.fire('squeezeend', inputSource, evt);
        });

        // add input sources
        const inputSources = session.inputSources;
        for (let i = 0; i < inputSources.length; i++) {
            this._addInputSource(inputSources[i]);
        }
    }

    /** @private */
    _onSessionEnd() {
        let i = this._inputSources.length;
        while (i--) {
            const inputSource = this._inputSources[i];
            this._inputSources.splice(i, 1);
            inputSource.fire('remove');
            this.fire('remove', inputSource);
        }

        const session = this.manager.session;
        session.removeEventListener('inputsourceschange', this._onInputSourcesChangeEvt);
    }

    /**
     * @param {XRInputSourcesChangeEvent} evt - WebXR input sources change event.
     * @private
     */
    _onInputSourcesChange(evt) {
        // remove
        for (let i = 0; i < evt.removed.length; i++) {
            this._removeInputSource(evt.removed[i]);
        }

        // add
        for (let i = 0; i < evt.added.length; i++) {
            this._addInputSource(evt.added[i]);
        }
    }

    /**
     * @param {XRInputSource} xrInputSource - Input source to search for.
     * @returns {XrInputSource|null} The input source that matches the given WebXR input source or
     * null if no match is found.
     * @private
     */
    _getByInputSource(xrInputSource) {
        for (let i = 0; i < this._inputSources.length; i++) {
            if (this._inputSources[i].inputSource === xrInputSource) {
                return this._inputSources[i];
            }
        }

        return null;
    }

    /**
     * @param {XRInputSource} xrInputSource - Input source to add.
     * @private
     */
    _addInputSource(xrInputSource) {
        if (this._getByInputSource(xrInputSource))
            return;

        const inputSource = new XrInputSource(this.manager, xrInputSource);
        this._inputSources.push(inputSource);
        this.fire('add', inputSource);
    }

    /**
     * @param {XRInputSource} xrInputSource - Input source to remove.
     * @private
     */
    _removeInputSource(xrInputSource) {
        for (let i = 0; i < this._inputSources.length; i++) {
            if (this._inputSources[i].inputSource !== xrInputSource)
                continue;

            const inputSource = this._inputSources[i];
            this._inputSources.splice(i, 1);

            let h = inputSource.hitTestSources.length;
            while (h--) {
                inputSource.hitTestSources[h].remove();
            }

            inputSource.fire('remove');
            this.fire('remove', inputSource);
            return;
        }
    }

    /**
     * @param {*} frame - XRFrame from requestAnimationFrame callback.
     * @ignore
     */
    update(frame) {
        for (let i = 0; i < this._inputSources.length; i++) {
            this._inputSources[i].update(frame);
        }
    }

    /**
     * List of active {@link XrInputSource} instances.
     *
     * @type {XrInputSource[]}
     */
    get inputSources() {
        return this._inputSources;
    }
}

export { XrInput };
