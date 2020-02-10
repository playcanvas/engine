Object.assign(pc, function () {
    var inputSourceId = 0;
    var quatA = new pc.Quat();

    var XrInputSource = function(inputSource) {
        pc.EventHandler.call(this);

        this.id = ++inputSourceId;
        this._inputSource = inputSource;

        this.type = '';

        this.ray = new pc.Ray();
        this.grip = null;
    };
    XrInputSource.prototype = Object.create(pc.EventHandler.prototype);
    XrInputSource.prototype.constructor = XrInputSource;


    var XrInputSources = function (manager) {
        pc.EventHandler.call(this);

        var self = this;

        this.manager = manager;
        this._session = null;
        this._sources = [ ];

        this._onInputSourcesChangeEvt = function(evt) {
            self._onInputSourcesChange(evt);
        };

        this.manager.on('start', this._onSessionStart, this);
        this.manager.on('end', this._onSessionEnd, this);

        this.on('add', function(inputSource) {
            console.log('add', inputSource);
        });

        this.on('remove', function(inputSource) {
            console.log('remove', inputSource);
        });
    };
    XrInputSources.prototype = Object.create(pc.EventHandler.prototype);
    XrInputSources.prototype.constructor = XrInputSources;

    // events
    // add
    // remove

    XrInputSources.prototype._onSessionStart = function () {
        this._session = this.manager.session;
        this._session.addEventListener('inputsourceschange', this._onInputSourcesChangeEvt);

        var self = this;

        this._session.addEventListener("select", function(evt) {
            console.log('select', evt);

            var inputSourcePose = evt.frame.getPose(evt.inputSource.targetRaySpace, self.manager._referenceSpace);
            if (inputSourcePose) {
                console.log(inputSourcePose);
            }
        });
        this._session.addEventListener("selectstart", function(evt) {
            console.log('selectstart', evt);
        });
        this._session.addEventListener("selectend", function(evt) {
            console.log('selectend', evt);
        });

        // add input sources
        var sources = this._session.inputSources;
        for(var i = 0; i < sources.length; i++) {
            this._addInputSource(sources[i]);
        }
    };

    XrInputSources.prototype._onSessionEnd = function () {
        // todo
        // fire remove event on all input sources
        var i = this._sources.length;
        while(i--) {
            var source = this._sources[i];
            this._sources.splice(i, 1);
            source.fire('remove');
            this.fire('remove', source);
        }

        this._session.removeEventListener('inputsourceschange', this._onInputSourcesChangeEvt);
        this._session = null;
    };

    XrInputSources.prototype._onInputSourcesChange = function (evt) {
        console.log('inputsourceschange', evt);

        // remove
        for(var i = 0; i < evt.removed.length; i++) {
            this._removeInputSource(evt.removed[i]);
        }

        // add
        for(var i = 0; i < evt.added.length; i++) {
            this._addInputSource(evt.added[i]);
        }
    };

    XrInputSources.prototype._addInputSource = function (inputSource) {
        var source = new XrInputSource(inputSource);
        this._sources.push(source);
        this.fire('add', source);
    };

    XrInputSources.prototype._removeInputSource = function (inputSource) {
        for(var i = 0; i < this._sources.length; i++) {
            if (this._sources[i]._inputSource !== inputSource)
                continue;

            var source = this._sources[i];
            this._sources.splice(i, 1);
            source.fire('remove');
            this.fire('remove', source);
            return;
        }
    };

    XrInputSources.prototype.update = function(frame) {
        for(var i = 0; i < this._sources.length; i++) {
            var source = this._sources[i];
            var inputSource = source._inputSource;

            var targetRayPose = frame.getPose(inputSource.targetRaySpace, this.manager._referenceSpace);

            if (! targetRayPose) {
                console.log('no targetRayPose', i);
                continue;
            }

            // if (inputSource.targetRayMode === 'gaze') {
                // if (! source.ray) source.ray = new pc.Ray();

                source.ray.origin.copy(targetRayPose.transform.position);

                source.ray.direction.set(0, 0, -1);
                quatA.copy(targetRayPose.transform.orientation);
                quatA.transformVector(source.ray.direction, source.ray.direction);

            // } else if (inputSource.targetRayMode === 'tracked-pointer') {
            //     if (! source.ray) source.ray = new pc.Ray();
            //
            //     source.ray.origin.copy(targetRayPose.transform.position);
            //
            //     source.ray.direction.set(0, 0, -1);
            //     quatA.copy(targetRayPose.transform.orientation);
            //     quatA.transformVector(source.ray.direction, source.ray.direction);
            // }

            if (inputSource.gripSpace) {
                var gripPose = frame.getPose(inputSource.gripSpace, this.manager._referenceSpace);
                if (gripPose) {
                    if (! source.grip) {
                        source.grip = {
                            position: new pc.Vec3(),
                            rotation: new pc.Quat()
                        };
                    };

                    source.grip.position.copy(gripPose.transform.position);
                    source.grip.rotation.copy(gripPose.transform.orientation);
                }
            }
        }
    };

    return {
        XrInputSources: XrInputSources
    };
}());
