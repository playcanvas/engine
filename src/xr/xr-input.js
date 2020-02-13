Object.assign(pc, function () {
    var XrInput = function (manager) {
        pc.EventHandler.call(this);

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
    XrInput.prototype = Object.create(pc.EventHandler.prototype);
    XrInput.prototype.constructor = XrInput;

    // EVENTS:
    // add
    // remove
    // select
    // selectstart
    // selectend

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
            inputSource.fire('selectstart', evt);
            self.fire('selectstart', inputSource, evt);
        });
        this._session.addEventListener('selectend', function (evt) {
            var inputSource = self._getByInputSource(evt.inputSource);
            inputSource.update(evt.frame);
            inputSource.fire('selectend', evt);
            self.fire('selectend', inputSource, evt);
        });

        // add input sources
        var sources = this._session.inputSources;
        for (var i = 0; i < sources.length; i++) {
            this._addInputSource(sources[i]);
        }
    };

    XrInput.prototype._onSessionEnd = function () {
        var i = this._inputSources.length;
        while (i--) {
            var source = this._inputSources[i];
            this._inputSources.splice(i, 1);
            source.fire('remove');
            this.fire('remove', source);
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

    XrInput.prototype._getByInputSource = function (inputSource) {
        for (var i = 0; i < this._inputSources.length; i++) {
            if (this._inputSources[i]._inputSource === inputSource) {
                return this._inputSources[i];
            }
        }

        return null;
    };

    XrInput.prototype._addInputSource = function (inputSource) {
        var source = new pc.XrInputSource(this.manager, inputSource);
        this._inputSources.push(source);
        this.fire('add', source);
    };

    XrInput.prototype._removeInputSource = function (inputSource) {
        for (var i = 0; i < this._inputSources.length; i++) {
            if (this._inputSources[i]._inputSource !== inputSource)
                continue;

            var source = this._inputSources[i];
            this._inputSources.splice(i, 1);
            source.fire('remove');
            this.fire('remove', source);
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

    return {
        XrInput: XrInput
    };
}());
