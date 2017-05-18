pc.extend(pc, function () {
    var _morphMin = new pc.Vec3();
    var _morphMax = new pc.Vec3();

    /**
     * @name pc.MorphTarget
     */
    var MorphTarget = function (indices, positions, normals, tangents) {
        this.indices = indices;
        this.positions = positions;
        this.normals = normals;
        this.tangents = tangents;
    };

    /**
     * @name pc.Morph
     */
    var Morph = function (baseVertexBuffer, baseAabb, targets) {
        this._baseBuffer = baseVertexBuffer;
        this._baseAabb = baseAabb;
        this._targets = targets;
        this._targetAabbs = [];
        this._targetAabbs.length = this._targets.length;
        this.aabb = new pc.BoundingBox(new pc.Vec3(), new pc.Vec3());
        this._dirty = true;

        this._baseData = new Float32Array(baseVertexBuffer.storage);

        var offsetP = -1;
        var offsetN = -1;
        var offsetT = -1;
        var elems = baseVertexBuffer.format.elements;
        var vertSize = baseVertexBuffer.format.size;
        for(var j=0; j<elems.length; j++) {
            if (elems[j].name === pc.SEMANTIC_POSITION) {
                offsetP = elems[j].offset;
            } else if (elems[j].name === pc.SEMANTIC_NORMAL) {
                offsetN = elems[j].offset;
            } else if (elems[j].name === pc.SEMANTIC_TANGENT) {
                offsetT = elems[j].offset;
            }
        }
        this._offsetPF = offsetP / 4;
        this._offsetNF = offsetN / 4;
        this._offsetTF = offsetT / 4;
        this._vertSizeF = vertSize / 4;
    };

    pc.extend(Morph.prototype, {
        _calculateAabb: function () {
            this.aabb.copy(this._baseAabb);

            this._targetAabbs.length = this._targets.length;
            //this.mesh.boneAabb = null; // to be recalculated

            var numVerts = this._baseBuffer.numVertices;
            var numIndices;
            var i, j, k, target, targetAabb, elems, vertSize, offsetP, offsetN, offsetT, dataF, offsetPF, offsetNF, offsetTF, vertSizeF;
            var x, y, z;

            for(i=0; i<this._targets.length; i++) {
                target = this._targets[i];
                targetAabb = this._targetAabbs[i];

                if (!targetAabb) {
                    targetAabb = this._targetAabbs[i] = this.aabb.clone();
                    _morphMin.set(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
                    _morphMax.set(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

                    numIndices = target.indices.length;
                    for(j=0; j<numIndices; j++) {
                        x = target.positions[j*3];
                        y = target.positions[j*3 + 1];
                        z = target.positions[j*3 + 2];

                        if (_morphMin.x > x) _morphMin.x = x;
                        if (_morphMin.y > y) _morphMin.y = y;
                        if (_morphMin.z > z) _morphMin.z = z;

                        if (_morphMax.x < x) _morphMax.x = x;
                        if (_morphMax.y < y) _morphMax.y = y;
                        if (_morphMax.z < z) _morphMax.z = z;
                    }
                    targetAabb.setMinMax(_morphMin, _morphMax);
                }
                this.aabb.add(targetAabb);
            }
        },

        addTarget: function (vb) {
            if (vb.numVertices !== this._baseBuffer.numVertices) {
                // #ifdef DEBUG
                console.error("Morph target vertex count doesn't match base mesh vertex count");
                // #endif
                return;
            }
            this._targets.push(vb);
            this._calculateAabb();
        },

        removeTarget: function (vb) {
            var index = this._targets.indexOf(vb);
            if (index !== -1) {
                this._targets.splice(index, 1);
                /*if (this._morphTargets.length === 0) {
                    if (this._morphedVertexBuffer) {
                        this._morphedVertexBuffer.destroy();
                        this._morphedVertexBuffer = null;
                        // TODO: make sure this is called when freeing resources
                    }
                } else {
                    this._calculateMorphingAabb();
                }*/
                this._calculateAabb();
            }
        }
    });

    /**
     * @name pc.MorphInstance
     */
    var MorphInstance = function (morph) {
        this.morph = morph;
        this._vertexBuffer = new pc.VertexBuffer(morph._baseBuffer.device, morph._baseBuffer.format,
                                                 morph._baseBuffer.numVertices, pc.BUFFER_DYNAMIC, morph._baseBuffer.storage.slice(0));
        this._vertexData = new Float32Array(this._vertexBuffer.storage);
        this._weights = [];
        for(var i=0; i<morph._targets.length; i++) {
            this._weights[i] = 0;
        }
        this._weights.length = this.morph._targets.length;
        this._dirty = true;
    };

    MorphInstance.prototype = {
        getWeight: function (index) {
            return this._weights[index];
        },

        setWeight: function (index, value) {
            this._weights[index] = value;
            this._dirty = true;
        },

        update: function () {

            var numVerts = this.morph._baseBuffer.numVertices;
            var numIndices, index;

            var targets = this.morph._targets;
            var weights = this._weights;
            var target, weight, j, id, j3;
            var vertSizeF = this.morph._vertSizeF;
            var offsetPF = this.morph._offsetPF;
            var offsetNF = this.morph._offsetNF;
            var offsetTF = this.morph._offsetTF;

            var baseData = this.morph._baseData;
            var vdata = this._vertexData;
            vdata.set(this.morph._baseData);

            for(var i=0; i<targets.length; i++) {
                weight = weights[i];
                if (weight === 0) continue;
                target = targets[i];
                numIndices = target.indices.length;

                for(j=0; j<numIndices; j++) {

                    j3 = j * 3;
                    index = target.indices[j];

                    id = index * vertSizeF + offsetPF;
                    vdata[id] += (target.positions[j3] - baseData[id]) * weight;
                    vdata[id + 1] += (target.positions[j3 + 1] - baseData[id + 1]) * weight;
                    vdata[id + 2] += (target.positions[j3 + 2] - baseData[id + 2]) * weight;

                    if (target.normals) {
                        id = index * vertSizeF + offsetNF;
                        vdata[id] += (target.normals[j3] - baseData[id]) * weight;
                        vdata[id + 1] += (target.normals[j3 + 1] - baseData[id + 1]) * weight;
                        vdata[id + 2] += (target.normals[j3 + 2] - baseData[id + 2]) * weight;

                        if (target.tangents) {
                            id = index * vertSizeF + offsetTF;
                            vdata[id] += (target.tangents[j3] - baseData[id]) * weight;
                            vdata[id + 1] += (target.tangents[j3 + 1] - baseData[id + 1]) * weight;
                            vdata[id + 2] += (target.tangents[j3 + 2] - baseData[id + 2]) * weight;
                            vdata[id + 3] += (target.tangents[j3 + 3] - baseData[id + 3]) * weight;
                        }
                    }

                }
            }

            this._vertexBuffer.unlock();
        }
    };

    return {
        MorphTarget: MorphTarget,
        Morph: Morph,
        MorphInstance: MorphInstance
    };
}());
