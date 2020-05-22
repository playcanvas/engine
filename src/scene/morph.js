Object.assign(pc, function () {

    /**
     * @class
     * @name pc.Morph
     * @classdesc Contains a list of pc.MorphTarget, a combined delta AABB and some associated data.
     * @param {pc.MorphTarget[]} targets - A list of morph targets.
     */
    var Morph = function (targets) {

        this._targets = targets;

        this._updateMorphFlags();
        this._calculateAabb();
    };

    Object.defineProperties(Morph.prototype, {
        'morphPositions': {
            get: function () {
                return this._morphPositions;
            }
        },

        'morphNormals': {
            get: function () {
                return this._morphNormals;
            }
        },

        'maxActiveTargets': {
            get: function () {
                return (this._morphPositions && this._morphNormals) ? 4 : 8;
            }
        }
    });

    Object.assign(Morph.prototype, {

        /**
         * @function
         * @name pc.Morph#destroy
         * @description Frees video memory allocated by this object.
         */
        destroy: function () {
            for (var i = 0; i < this._targets.length; i++) {
                this._targets[i].destroy();
            }
            this._targets.length = 0;
        },

        /**
         * @function
         * @name pc.Morph#getTarget
         * @description Gets the morph target by index.
         * @param {number} index - An index of morph target.
         * @returns {pc.MorphTarget} A morph target object.
         */
        getTarget: function (index) {
            return this._targets[index];
        },

        _updateMorphFlags: function () {

            // find out if this morph needs to morph positions and normals
            this._morphPositions = false;
            this._morphNormals = false;
            var target;
            for (var i = 0; i < this._targets.length; i++) {
                target = this._targets[i];
                if (target.morphPositions) {
                    this._morphPositions = true;
                }
                if (target.morphNormals) {
                    this._morphNormals = true;
                }
            }
        },

        _calculateAabb: function () {

            this.aabb = new pc.BoundingBox(new pc.Vec3(0, 0, 0), new pc.Vec3(0, 0, 0));
            var target;

            // calc bounding box of the relative change this morph can add
            for (var i = 0; i < this._targets.length; i++) {
                target = this._targets[i];
                this.aabb._expand(target.aabb.getMin(), target.aabb.getMax());
            }
        }
    });

    return {
        Morph: Morph
    };
}());
