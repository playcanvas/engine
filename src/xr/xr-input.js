import { EventHandler } from '../core/event-handler.js';

import { XrInputSource } from './xr-input-source.js';

/**
 * @class
 * @name pc.XrInput
 * @augments pc.EventHandler
 * @classdesc Provides access to input sources for WebXR.
 * @description Provides access to input sources for WebXR.
 * @param {pc.XrManager} manager - WebXR Manager.
 * @property {pc.XrInputSource[]} inputSources List of active {@link pc.XrInputSource}.
 */
function XrInput(manager) {
    EventHandler.call(this);

    var self = this;

    this.manager = manager;
    this._session = null;
    this._inputSources = [];

    this._onInputSourcesChangeEvt = function (evt) {
        self._onInputSourcesChange(evt);
    };

    this.manager.on('start', this._onSessionStart, this);
    this.manager.on('end', this._onSessionEnd, this);
};
XrInput.prototype = Object.create(EventHandler.prototype);
XrInput.prototype.constructor = XrInput;

/**
 * @event
 * @name pc.XrInput#add
 * @description Fired when new {@link pc.XrInputSource} is added to the list.
 * @param {pc.XrInputSource} inputSource - Input source that has been added
 * @example
 * app.xr.input.on('add', function (inputSource) {
 *     // new input source is added
 * });
 */

/**
 * @event
 * @name pc.XrInput#remove
 * @description Fired when {@link pc.XrInputSource} is removed to the list.
 * @param {pc.XrInputSource} inputSource - Input source that has been removed
 * @example
 * app.xr.input.on('remove', function (inputSource) {
 *     // input source is removed
 * });
 */

/**
 * @event
 * @name pc.XrInput#select
 * @description Fired when {@link pc.XrInputSource} has triggered primary action. This could be pressing a trigger button, or touching a screen.
 * @param {pc.XrInputSource} inputSource - Input source that triggered select event
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
 * @name pc.XrInput#selectstart
 * @description Fired when {pc.XrInputSource} has started to trigger primary action.
 * @param {pc.XrInputSource} inputSource - Input source that triggered selectstart event
 * @param {object} evt - XRInputSourceEvent event data from WebXR API
 */

/**
 * @event
 * @name pc.XrInput#selectend
 * @description Fired when {pc.XrInputSource} has ended triggerring primary action.
 * @param {pc.XrInputSource} inputSource - Input source that triggered selectend event
 * @param {object} evt - XRInputSourceEvent event data from WebXR API
 */

XrInput.prototype._onSessionStart = function () {
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

    // add input sources
    var inputSources = this._session.inputSources;
    for (var i = 0; i < inputSources.length; i++) {
        this._addInputSource(inputSources[i]);
    }
};

XrInput.prototype._onSessionEnd = function () {
    var i = this._inputSources.length;
    while (i--) {
        var inputSource = this._inputSources[i];
        this._inputSources.splice(i, 1);
        inputSource.fire('remove');
        this.fire('remove', inputSource);
    }

    this._session.removeEventListener('inputsourceschange', this._onInputSourcesChangeEvt);
    this._session = null;
};

XrInput.prototype._onInputSourcesChange = function (evt) {
    var i;

    // remove
    for (i = 0; i < evt.removed.length; i++) {
        this._removeInputSource(evt.removed[i]);
    }

    // add
    for (i = 0; i < evt.added.length; i++) {
        this._addInputSource(evt.added[i]);
    }
};

XrInput.prototype._getByInputSource = function (xrInputSource) {
    for (var i = 0; i < this._inputSources.length; i++) {
        if (this._inputSources[i].inputSource === xrInputSource) {
            return this._inputSources[i];
        }
    }

    return null;
};

XrInput.prototype._addInputSource = function (xrInputSource) {
    if (this._getByInputSource(xrInputSource))
        return;

    var inputSource = new XrInputSource(this.manager, xrInputSource);
    this._inputSources.push(inputSource);
    this.fire('add', inputSource);
};

XrInput.prototype._removeInputSource = function (xrInputSource) {
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
};

XrInput.prototype.update = function (frame) {
    for (var i = 0; i < this._inputSources.length; i++) {
        this._inputSources[i].update(frame);
    }
};

Object.defineProperty(XrInput.prototype, 'inputSources', {
    get: function () {
        return this._inputSources;
    }
});

export { XrInput };
