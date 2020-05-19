Object.assign(pc, function () {

    /**
     * @class
     * @name pc.MorphInstance
     * @classdesc An instance of pc.Morph. Contains weights to assign to every pc.MorphTarget, manages selection of active morph targets.
     * @param {pc.Morph} morph - The pc.Morph to instance.
     */
    var MorphInstance = function (morph) {
        this.morph = morph;

        // weights
        this._weights = [];
        this._dirty = true;

        // weights of active vertex buffers in format used by rendering
        this._shaderMorphWeights = new Float32Array(pc.MorphInstance.RENDER_TARGET_COUNT);          // whole array
        this._shaderMorphWeightsA = new Float32Array(this._shaderMorphWeights.buffer, 0, 4);        // first 4 elements
        this._shaderMorphWeightsB = new Float32Array(this._shaderMorphWeights.buffer, 4 * 4, 4);    // second 4 elements

        // temporary array of targets with non-zero weight
        this._activeTargets = [];

        // pre-allocate array of active vertex buffers used by rendering
        this._activeVertexBuffers = new Array(pc.MorphInstance.RENDER_TARGET_COUNT);
    };

    Object.defineProperties(MorphInstance, {
        // number of vertex buffer / weight slots
        RENDER_TARGET_COUNT: { value: 8 }
    });

    Object.assign(MorphInstance.prototype, {

        /**
         * @function
         * @name pc.MorphInstance#destroy
         * @description Frees video memory allocated by this object.
         */
        destroy: function () {
            if (this.morph) {
                this.morph.destroy();
                this.morph = null;
            }
        },

        /**
         * @function
         * @name pc.MorphInstance#getWeight
         * @description Gets current weight of the specified morph target.
         * @param {number} index - An index of morph target.
         * @returns {number} Weight.
         */
        getWeight: function (index) {
            return this._weights[index];
        },

        /**
         * @function
         * @name pc.MorphInstance#setWeight
         * @description Sets weight of the specified morph target.
         * @param {number} index - An index of morph target.
         * @param {number} weight - Weight.
         */
        setWeight: function (index, weight) {
            this._weights[index] = weight;
            this._dirty = true;
        },

        /**
         * @function
         * @name pc.MorphInstance#update
         * @description Selects active morph targets and prepares morph for rendering. Called automatically by renderer.
         */
        update: function () {

            var targets = this.morph._targets;

            // collect active targets
            this._activeTargets.length = 0;
            var i, absWeight, epsilon = 0.00001;
            for (i = 0; i < targets.length; i++) {
                absWeight = Math.abs(this.getWeight(i));
                if (absWeight > epsilon) {
                    this._activeTargets.push({
                        absWeight: absWeight,
                        weight: this.getWeight(i),
                        target: targets[i]
                    });
                }
            }

            // if there's more active targets then rendering supports
            var maxActiveTargets = this.morph.maxActiveTargets;
            if (this._activeTargets.length > maxActiveTargets) {

                // sort them by absWeight
                this._activeTargets.sort(function (l, r) {
                    return (l.absWeight < r.absWeight) ? 1 : (r.absWeight < l.absWeight ? -1 : 0);
                });

                // remove excess
                this._activeTargets.length = maxActiveTargets;
            }

            // prepare 8 slots for rendering. these are supported combinations: PPPPPPPP, NNNNNNNN, PPPPNNNN
            var count = pc.MorphInstance.RENDER_TARGET_COUNT;
            for (i = 0; i < count; i++) {
                this._shaderMorphWeights[i] = 0;
                this._activeVertexBuffers[i] = null;
            }

            var posIndex = 0;
            var nrmIndex = this.morph.morphPositions ? 4 : 0;
            var target;
            for (i = 0; i < this._activeTargets.length; i++) {
                target = this._activeTargets[i].target;

                if (target._vertexBufferPositions) {
                    this._activeVertexBuffers[posIndex] = target._vertexBufferPositions;
                    this._shaderMorphWeights[posIndex] = this._activeTargets[i].weight;
                    posIndex++;
                }

                if (target._vertexBufferNormals) {
                    this._activeVertexBuffers[nrmIndex] = target._vertexBufferNormals;
                    this._shaderMorphWeights[nrmIndex] = this._activeTargets[i].weight;
                    nrmIndex++;
                }
            }
        }
    });

    return {
        MorphInstance: MorphInstance
    };
}());
