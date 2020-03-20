Object.assign(pc, function () {
    var poolVec3 = [];
    var poolQuat = [];


    /**
     * @class
     * @name pc.XrHitTestSource
     * @augments pc.EventHandler
     * @classdesc Represents XR hit test source, which provides access to hit results of real world geometry from AR session.
     * @description Represents XR hit test source, which provides access to hit results of real world geometry from AR session.
     * @param {pc.XrManager} manager - WebXR Manager.
     * @param {object} xrHitTestSource - XRHitTestSource object that is created by WebXR API.
     * @param {boolean} transient - True if XRHitTestSource created for input source profile.
     * @example
     * hitTestSource.on('result', function (position, rotation) {
     *     target.setPosition(position);
     * });
     */
    var XrHitTestSource = function (manager, xrHitTestSource, transient) {
        pc.EventHandler.call(this);

        this.manager = manager;
        this._xrHitTestSource = xrHitTestSource;
        this._transient = transient;
    };
    XrHitTestSource.prototype = Object.create(pc.EventHandler.prototype);
    XrHitTestSource.prototype.constructor = XrHitTestSource;

    /**
     * @event
     * @name pc.XrHitTestSource#remove
     * @description Fired when {pc.XrHitTestSource} is removed.
     * @example
     * hitTestSource.once('remove', function () {
     *     // hit test source has been removed
     * });
     */

    /**
     * @event
     * @name pc.XrHitTestSource#result
     * @description Fired when hit test source receives new results. It provides transform information that tries to match real world picked geometry.
     * @param {pc.Vec3} position - Position of hit test
     * @param {pc.Quat} rotation - Rotation of hit test
     * @param {pc.XrInputSource|null} inputSource - If is transient hit test source, then it will provide related input source
     * @example
     * hitTestSource.on('result', function (position, rotation, inputSource) {
     *     target.setPosition(position);
     *     target.setRotation(rotation);
     * });
     */

    /**
     * @function
     * @name pc.XrHitTestSource#remove
     * @description Stop and remove hit test source.
     */
    XrHitTestSource.prototype.remove = function () {
        if (! this._xrHitTestSource)
            return;

        var hitTestSources = this.manager.hitTest.hitTestSources;
        var ind = hitTestSources.indexOf(this);
        if (ind !== -1) hitTestSources.splice(ind, 1);

        this.onStop();
    };

    XrHitTestSource.prototype.onStop = function () {
        this._xrHitTestSource.cancel();
        this._xrHitTestSource = null;

        this.fire('remove');
        this.manager.hitTest.fire('remove', this);
    };

    XrHitTestSource.prototype.update = function (frame) {
        if (this._transient) {
            var transientResults = frame.getHitTestResultsForTransientInput(this._xrHitTestSource);
            for (var i = 0; i < transientResults.length; i++) {
                var transientResult = transientResults[i];
                var inputSource;

                if (transientResult.inputSource)
                    inputSource = this.manager.input._getByInputSource(transientResult.inputSource);

                this.updateHitResults(transientResult.results, inputSource);
            }
        } else {
            this.updateHitResults(frame.getHitTestResults(this._xrHitTestSource));
        }
    };

    XrHitTestSource.prototype.updateHitResults = function (results, inputSource) {
        for (var i = 0; i < results.length; i++) {
            var pose = results[i].getPose(this.manager._referenceSpace);

            var position = poolVec3.pop();
            if (! position) position = new pc.Vec3();
            position.copy(pose.transform.position);

            var rotation = poolQuat.pop();
            if (! rotation) rotation = new pc.Quat();
            rotation.copy(pose.transform.orientation);

            this.fire('result', position, rotation, inputSource);
            this.manager.hitTest.fire('result', this, position, rotation, inputSource);

            poolVec3.push(position);
            poolQuat.push(rotation);
        }
    };


    return { XrHitTestSource: XrHitTestSource };
}());
