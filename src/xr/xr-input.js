import { EventHandler } from '../core/event-handler.js';

import { XrInputSource } from './xr-input-source.js';

/**
 * @class
 * @name XrInput
 * @augments EventHandler
 * @classdesc Provides access to input sources for WebXR.
 * @description Provides access to input sources for WebXR.
 * @param {XrManager} manager - WebXR Manager.
 * @property {XrInputSource[]} inputSources List of active {@link XrInputSource}.
 */
class XrInput extends EventHandler {
    constructor(manager) {
        super();

        var self = this;

        this.manager = manager;
        this._session = null;
        this._inputSources = [];

        this._onInputSourcesChangeEvt = function (evt) {
            self._onInputSourcesChange(evt);
        };

        this.manager.on('start', this._onSessionStart, this);
        this.manager.on('end', this._onSessionEnd, this);
    }

    /**
     * @event
     * @name XrInput#add
     * @description Fired when new {@link XrInputSource} is added to the list.
     * @param {XrInputSource} inputSource - Input source that has been added
     * @example
     * app.xr.input.on('add', function (inputSource) {
     *     // new input source is added
     * });
     */

    /**
     * @event
     * @name XrInput#remove
     * @description Fired when {@link XrInputSource} is removed to the list.
     * @param {XrInputSource} inputSource - Input source that has been removed
     * @example
     * app.xr.input.on('remove', function (inputSource) {
     *     // input source is removed
     * });
     */

    /**
     * @event
     * @name XrInput#select
     * @description Fired when {@link XrInputSource} has triggered primary action. This could be pressing a trigger button, or touching a screen.
     * @param {XrInputSource} inputSource - Input source that triggered select event
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     * @example
     * var ray = new pc.Ray();
     * app.xr.input.on('select', function (inputSource, evt) {
     *     ray.set(inputSource.getOrigin(), inputSource.getDirection());
     *     if (obj.intersectsRay(ray)) {
     *         // selected an object with input source
     *     }
     * });
     */

    /**
     * @event
     * @name XrInput#selectstart
     * @description Fired when {@link XrInputSource} has started to trigger primary action.
     * @param {XrInputSource} inputSource - Input source that triggered selectstart event
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     */

    /**
     * @event
     * @name XrInput#selectend
     * @description Fired when {@link XrInputSource} has ended triggerring primary action.
     * @param {XrInputSource} inputSource - Input source that triggered selectend event
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     */

    /**
     * @event
     * @name XrInput#squeeze
     * @description Fired when {@link XrInputSource} has triggered squeeze action. This is associated with "grabbing" action on the controllers.
     * @param {XrInputSource} inputSource - Input source that triggered squeeze event
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     */

    /**
     * @event
     * @name XrInput#squeezestart
     * @description Fired when {@link XrInputSource} has started to trigger sqeeze action.
     * @param {XrInputSource} inputSource - Input source that triggered squeezestart event
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     * @example
     * app.xr.input.on('squeezestart', function (inputSource, evt) {
     *     if (obj.containsPoint(inputSource.getPosition())) {
     *         // grabbed an object
     *     }
     * });
     */

    /**
     * @event
     * @name XrInput#squeezeend
     * @description Fired when {@link XrInputSource} has ended triggerring sqeeze action.
     * @param {XrInputSource} inputSource - Input source that triggered squeezeend event
     * @param {object} evt - XRInputSourceEvent event data from WebXR API
     */

    _onSessionStart() {
        this._session = this.manager.session;
        this._session.addEventListener('inputsourceschange', this._onInputSourcesChangeEvt);

        var self = this;

        this._session.addEventListener('select', function (evt) {
            var inputSource = self._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource.fire('select', evt);
            self.fire('select', inputSource, evt);
        });
        this._session.addEventListener('selectstart', function (evt) {
            var inputSource = self._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource._selecting = true;
            inputSource.fire('selectstart', evt);
            self.fire('selectstart', inputSource, evt);
        });
        this._session.addEventListener('selectend', function (evt) {
            var inputSource = self._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource._selecting = false;
            inputSource.fire('selectend', evt);
            self.fire('selectend', inputSource, evt);
        });

        this._session.addEventListener('squeeze', function (evt) {
            var inputSource = self._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource.fire('squeeze', evt);
            self.fire('squeeze', inputSource, evt);
        });
        this._session.addEventListener('squeezestart', function (evt) {
            var inputSource = self._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource._squeezing = true;
            inputSource.fire('squeezestart', evt);
            self.fire('squeezestart', inputSource, evt);
        });
        this._session.addEventListener('squeezeend', function (evt) {
            var inputSource = self._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource._squeezing = false;
            inputSource.fire('squeezeend', evt);
            self.fire('squeezeend', inputSource, evt);
        });

        // add input sources
        var inputSources = this._session.inputSources;
        for (var i = 0; i < inputSources.length; i++) {
            this._addInputSource(inputSources[i]);
        }
    }

    _onSessionEnd() {
        var i = this._inputSources.length;
        while (i--) {
            var inputSource = this._inputSources[i];
            this._inputSources.splice(i, 1);
            inputSource.fire('remove');
            this.fire('remove', inputSource);
        }

        this._session.removeEventListener('inputsourceschange', this._onInputSourcesChangeEvt);
        this._session = null;
    }

    _onInputSourcesChange(evt) {
        var i;

        // remove
        for (i = 0; i < evt.removed.length; i++) {
            this._removeInputSource(evt.removed[i]);
        }

        // add
        for (i = 0; i < evt.added.length; i++) {
            this._addInputSource(evt.added[i]);
        }
    }

    _getByInputSource(xrInputSource) {
        for (var i = 0; i < this._inputSources.length; i++) {
            if (this._inputSources[i].inputSource === xrInputSource) {
                return this._inputSources[i];
            }
        }

        return null;
    }

    _addInputSource(xrInputSource) {
        if (this._getByInputSource(xrInputSource))
            return;

        var inputSource = new XrInputSource(this.manager, xrInputSource);
        this._inputSources.push(inputSource);
        this.fire('add', inputSource);
    }

    _removeInputSource(xrInputSource) {
        for (var i = 0; i < this._inputSources.length; i++) {
            if (this._inputSources[i].inputSource !== xrInputSource)
                continue;

            var inputSource = this._inputSources[i];
            this._inputSources.splice(i, 1);

            var h = inputSource.hitTestSources.length;
            while (h--) {
                inputSource.hitTestSources[h].remove();
            }

            inputSource.fire('remove');
            this.fire('remove', inputSource);
            return;
        }
    }

    update(frame) {
        for (var i = 0; i < this._inputSources.length; i++) {
            this._inputSources[i].update(frame);
        }
    }

    get inputSources() {
        return this._inputSources;
    }
}

export { XrInput };
