pc.extend(pc.scene, function () {

    var tempMat = pc.math.mat4.create();
    var tempVec = pc.math.vec3.create();
    var tempQuatA = pc.math.quat.create();
    var tempQuatB = pc.math.quat.create();
    var syncList = [];

    /**
     * @name pc.scene.GraphNode
     * @class A hierarchical scene node.
     * @param {String} name Non-unique, human readable name.
     * @property {pc.math.vec3} right Vector representing the X direction of the node in world space (read only).
     * @property {pc.math.vec3} up Vector representing the Y direction of the node in world space (read only).
     * @property {pc.math.vec3} forwards Vector representing the negative Z direction of the node in world space (read only).
     */
    var GraphNode = function GraphNode(name) {
        this._name = name || ""; // Non-unique human readable name
        this._labels = {};
        this._graphId = -1;

        // Local-space properties of transform (only first 3 are settable by the user)
        this.localPosition = pc.math.vec3.create(0, 0, 0);
        this.localRotation = pc.math.quat.create(0, 0, 0, 1);
        this.localScale = pc.math.vec3.create(1, 1, 1);
        this.localEulerAngles = pc.math.vec3.create(0, 0, 0); // Only calculated on request

        // World-space properties of transform
        this.position = pc.math.vec3.create(0, 0, 0);
        this.rotation = pc.math.quat.create(0, 0, 0, 1);
        this.eulerAngles = pc.math.vec3.create(0, 0, 0);

        this.localTransform = pc.math.mat4.create();
        this.dirtyLocal = false;

        this.worldTransform = pc.math.mat4.create();
        this.dirtyWorld = false;

        this._right = pc.math.vec3.create();
        this._up = pc.math.vec3.create();
        this._forwards = pc.math.vec3.create();

        this._parent = null;
        this._children = [];
    };

    Object.defineProperty(GraphNode.prototype, 'right', {
        get: function() {
            var transform = this.getWorldTransform();

            pc.math.mat4.getX(transform, this._right);
            pc.math.vec3.normalize(this._right, this._right);

            return this._right;
        }
    });

    Object.defineProperty(GraphNode.prototype, 'up', {
        get: function() {
            var transform = this.getWorldTransform();

            pc.math.mat4.getY(transform, this._up);
            pc.math.vec3.normalize(this._up, this._up);

            return this._up;
        }
    });

    Object.defineProperty(GraphNode.prototype, 'forwards', {
        get: function() {
            var transform = this.getWorldTransform();

            pc.math.mat4.getZ(transform, this._forwards);
            pc.math.vec3.normalize(this._forwards, this._forwards);
            pc.math.vec3.scale(this._forwards, -1, this._forwards);

            return this._forwards;
        }
    });

    pc.extend(GraphNode.prototype, {

        _cloneInternal: function (clone) {
            clone._name = this._name;
            clone._labels = pc.extend(this._lables, {});
            clone._graphId = this._graphId;

            pc.math.vec3.copy(this.localPosition, clone.localPosition);
            pc.math.quat.copy(this.localRotation, clone.localRotation);
            pc.math.vec3.copy(this.localScale, clone.localScale);
            pc.math.vec3.copy(this.localEulerAngles, clone.localEulerAngles);

            pc.math.vec3.copy(this.position, clone.position);
            pc.math.quat.copy(this.rotation, clone.rotation);
            pc.math.vec3.copy(this.eulerAngles, clone.eulerAngles);

            pc.math.mat4.copy(this.localTransform, clone.localTransform);
            clone.dirtyLocal = clone.dirtyLocal;

            pc.math.mat4.copy(this.worldTransform, clone.worldTransform);
            clone.dirtyWorld = clone.dirtyWorld;
        },

        clone: function () {
            var clone = new pc.scene.GraphNode();
            this._cloneInternal(clone);
            return clone;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#addGraphId
         * @description The Graph ID is used to patch up nodes while loading graph data from files. A Graph ID is added during the loading process and should 
         * be removed again by called removeGraphId() once the loading is complete.
         * @param {String} id The ID from the data file which is added to the node temporarily
         */
        addGraphId: function (id) {
            this._graphId = id;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#removeGraphId
         * @description The Graph ID is used to patch up nodes while loading graph data from files. A Graph ID is added during the loading process by calling addGraphId() and should 
         * be removed again by called removeGraphId() once the loading is complete.
         */
        removeGraphId: function () {
            delete this._graphId;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#find
         * @description Search the graph for nodes using a supplied property or method name to get the value to search on.
         * @param {String} attr The attribute name on the node to search for, if this corresponds to a function name then the function return value is used in the comparison
         * @param {String} value The value of the attr to look for
         * @returns {Array} An array of GraphNodes
         * @example
         * var graph = ... // Get a pc.fw.Entity hierarchy from somewhere 
         * var results = graph.find("getGuid", "1234");
         */
        find: function (attr, value) {
            var i;
            var children = this.getChildren();
            var length = children.length;
            var results = [];
            var testValue;
            if(this[attr]) {
                if(this[attr] instanceof Function) {
                    testValue = this[attr]();    
                } else {
                    testValue = this[attr];
                }
                if(testValue === value) {
                    results.push(this);
                }            
            }
            
            for(i = 0; i < length; ++i) {
                results = results.concat(children[i].find(attr, value));
            }
            
            return results;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#findOne
         * @description @see pc.scene.GraphNode#find, but this will only return the first graph node
         * that it finds.
         * @param {String} attr The property or function name to search using.
         * @param {String} value The value to search for.
         * @returns {pc.scene.GraphNode} A single graph node.
         */
        findOne: function(attr, value) {
            var i;
            var children = this.getChildren();
            var length = children.length;
            var result = null;
            var testValue;
            if(this[attr]) {
                if(this[attr] instanceof Function) {
                    testValue = this[attr]();    
                } else {
                    testValue = this[attr];
                }
                if(testValue === value) {
                    return this;
                }
            }
            
            for(i = 0; i < length; ++i) {
                 result = children[i].findOne(attr, value);
                 if(result !== null) {
                     return result;
                 }
            }
            
            return null;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#findByName
         * @description Get the first node found in the graph with the name. The search
         * is depth first.
         * @returns {pc.scene.GraphNode} The first node to be found matching the supplied name.
         * @author Will Eastcott
         */
        findByName: function (name) {
            if (this._name === name) return this;

            for (var i = 0; i < this._children.length; i++) {
                var found = this._children[i].findByName(name);
                if (found !== null) return found;
            }
            return null;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#findByGraphId
         * @description
         * @returns {pc.scene.GraphNode}
         */
        findByGraphId: function (id) {
            if (this._graphId === id) return this;

            for (var i = 0; i < this._children.length; i++) {
                var found = this._children[i].findByGraphId(id);
                if (found !== null) return found;
            }
            return null;

        },

        /**
         * @function
         * @name pc.scene.GraphNode#getRoot
         * @description Get the highest ancestor node from this graph node.
         * @return {pc.scene.GraphNode} The root node of the hierarchy to which this node belongs.
         */
        getRoot: function () {
            var parent = this.getParent();
            if (!parent) {
                return this;
            }

            while (parent.getParent()) {
                parent = parent.getParent();
            }

            return parent;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getParent
         * @description Get the parent GraphNode
         * @returns {pc.scene.GraphNode} The parent node
         */
        getParent: function () {
            return this._parent;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getChildren
         * @description Get the children of this graph node.
         * @returns {Array} The child array of this node.
         * @author Will Eastcott
         */
        getChildren: function () {
            return this._children;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getEulerAngles
         * @description Get the world space rotation for the specified GraphNode in Euler angle
         * form. The order of the returned Euler angles is XYZ. The value returned by this function 
         * should be considered read-only. In order to set the world-space rotation of the graph 
         * node, use pc.scene.GraphNode#setEulerAngles.
         * @returns {pc.math.vec3} The world space rotation of the graph node in Euler angle form.
         * @author Will Eastcott
         */
        getEulerAngles: function () {
            var worldTransform = this.getWorldTransform();
            pc.math.mat4.toEulerXYZ(worldTransform, this.eulerAngles);
            return this.eulerAngles;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getLocalEulerAngles
         * @description Get the rotation in local space for the specified GraphNode. The rotation
         * is returned as eurler angles in a 3-dimensional vector where the order is XYZ. The 
         * returned vector should be considered read-only. To update the local rotation, use 
         * pc.scene.GraphNode#setLocalEulerAngles.
         * @returns {pc.math.vec3} The local space rotation of the graph node as euler angles in XYZ order.
         * @author Will Eastcott
         */
        getLocalEulerAngles: function () {
            pc.math.quat.toEulers(this.localRotation, this.localEulerAngles);
            return this.localEulerAngles;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getLocalPosition
         * @description Get the position in local space for the specified GraphNode. The position
         * is returned as a 3-dimensional vector. The returned vector should be considered read-only.
         * To update the local position, use pc.scene.GraphNode#setLocalPosition.
         * @returns {pc.math.vec3} The local space position of the graph node.
         * @author Will Eastcott
         */
        getLocalPosition: function () {
            return this.localPosition;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getLocalRotation
         * @description Get the rotation in local space for the specified GraphNode. The rotation
         * is returned as a quaternion. The returned quaternion should be considered read-only.
         * To update the local rotation, use pc.scene.GraphNode#setLocalRotation.
         * @returns {pc.math.quat} The local space rotation of the graph node as a quaternion.
         * @author Will Eastcott
         */
        getLocalRotation: function () {
            return this.localRotation;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getLocalScale
         * @description Get the scale in local space for the specified GraphNode. The scale
         * is returned as a 3-dimensional vector. The returned vector should be considered read-only.
         * To update the local scale, use pc.scene.GraphNode#setLocalScale.
         * @returns {pc.math.vec3} The local space scale of the graph node.
         * @author Will Eastcott
         */
        getLocalScale: function () {
            return this.localScale;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getLocalTransform
         * @description Get the local transform matrix for this graph node. This matrix
         * is the transform relative to the node's parent's world transformation matrix.
         * @returns {pc.math.mat4} The node's local transformation matrix.
         * @author Will Eastcott
         */
        getLocalTransform: function () {
            if (this.dirtyLocal) {
                pc.math.mat4.compose(this.localPosition, this.localRotation, this.localScale, this.localTransform);

                this.dirtyLocal = false;
                this.dirtyWorld = true;
            }
            return this.localTransform;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getName
         * @description Get the human-readable name for this graph node. Note the name
         * is not guaranteed to be unique.
         * @returns {String} The name of the node.
         * @author Will Eastcott
         */
        getName: function () {
            return this._name;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getPosition
         * @description Get the world space position for the specified GraphNode. The
         * value returned by this function should be considered read-only. In order to set
         * the world-space position of the graph node, use pc.scene.GraphNode#setPosition.
         * @returns {pc.math.vec3} The world space position of the graph node.
         * @author Will Eastcott
         */
        getPosition: function () {
            var worldTransform = this.getWorldTransform();
            pc.math.mat4.getTranslation(worldTransform, this.position);
            return this.position;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getRotation
         * @description Get the world space rotation for the specified GraphNode in quaternion
         * form. The value returned by this function should be considered read-only. In order 
         * to set the world-space rotation of the graph node, use pc.scene.GraphNode#setRotation.
         * @returns {pc.math.quat} The world space rotation of the graph node as a quaternion.
         * @author Will Eastcott
         */
        getRotation: function () {
            var worldTransform = this.getWorldTransform();
            pc.math.quat.fromMat4(worldTransform, this.rotation);
            return this.rotation;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getWorldTransform
         * @description Get the world transformation matrix for this graph node.
         * @returns {pc.math.mat4} The node's world transformation matrix.
         * @author Will Eastcott
         */
        getWorldTransform: function () {
            var current = this;
            syncList.length = 0;
            while (current !== null) {
                syncList.push(current);
                current = current._parent;
            }
            for (var i = syncList.length - 1; i >= 0; i--) {
                syncList[i].sync();
            }
            return this.worldTransform;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setLocalEulerAngles
         * @description Sets the local space rotation of the specified graph node using euler angles.
         * Eulers are interpreted in XYZ order. Eulers must be specified in degrees.
         * @param {pc.math.vec3} e vector containing euler angles in XYZ order.
         * @author Will Eastcott
         */
        /**
         * @function
         * @name pc.scene.GraphNode#setLocalEulerAngles^2
         * @description Sets the local space rotation of the specified graph node using euler angles.
         * Eulers are interpreted in XYZ order. Eulers must be specified in degrees.
         * @param {Number} x rotation around x-axis in degrees.
         * @param {Number} y rotation around y-axis in degrees.
         * @param {Number} z rotation around z-axis in degrees.
         * @author Will Eastcott
         */
        setLocalEulerAngles: function () {
            if (arguments.length === 1) {
                pc.math.quat.fromEulerXYZ(arguments[0][0], arguments[0][1], arguments[0][2], this.localRotation);
            } else {
                pc.math.quat.fromEulerXYZ(arguments[0], arguments[1], arguments[2], this.localRotation);
            }
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setLocalPosition
         * @description Sets the local space position of the specified graph node.
         * @param {pc.math.vec3} pos position vector of graph node in local space.
         * @author Will Eastcott
         */
        /**
         * @function
         * @name pc.scene.GraphNode#setLocalPosition^2
         * @description Sets the local space position of the specified graph node.
         * @param {Number} x x-coordinate of local-space position.
         * @param {Number} y y-coordinate of local-space position.
         * @param {Number} z z-coordinate of local-space position.
         * @author Will Eastcott
         */
        setLocalPosition: function () {
            if (arguments.length === 1) {
                this.localPosition[0] = arguments[0][0];
                this.localPosition[1] = arguments[0][1];
                this.localPosition[2] = arguments[0][2];
            } else {
                this.localPosition[0] = arguments[0];
                this.localPosition[1] = arguments[1];
                this.localPosition[2] = arguments[2];
            }
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setLocalRotation
         * @description Sets the local space rotation of the specified graph node.
         * @param {pc.math.quat} q quaternion representing rotation of graph node in local space.
         * @author Will Eastcott
         */
        setLocalRotation: function (q) {
            pc.math.quat.copy(q, this.localRotation);
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setLocalScale
         * @description Sets the local space scale factor of the specified graph node.
         * @param {pc.math.vec3} scale xyz-scale of graph node in local space.
         * @author Will Eastcott
         */
        /**
         * @function
         * @name pc.scene.GraphNode#setLocalScale^2
         * @description Sets the local space scale factor of the specified graph node.
         * @param {Number} x x-coordinate of local-space scale.
         * @param {Number} y y-coordinate of local-space scale.
         * @param {Number} z z-coordinate of local-space scale.
         * @author Will Eastcott
         */
        setLocalScale: function () {
            if (arguments.length === 1) {
                this.localScale[0] = arguments[0][0];
                this.localScale[1] = arguments[0][1];
                this.localScale[2] = arguments[0][2];
            } else {
                this.localScale[0] = arguments[0];
                this.localScale[1] = arguments[1];
                this.localScale[2] = arguments[2];
            }
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setName
         * @description Sets the non-unique name for this graph node.
         * @param {String} name The name for the node.
         * @author Will Eastcott
         */
        setName: function (name) {
            this._name = name;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setPosition
         * @description Sets the world space position of the specified graph node.
         * @param {pc.math.vec3} position world space position (xyz) of graph node.
         * @author Will Eastcott
         */
        /**
         * @function
         * @name pc.scene.GraphNode#setPosition^2
         * @description Sets the world space position of the specified graph node.
         * @param {Number} x x-coordinate of world-space position.
         * @param {Number} y y-coordinate of world-space position.
         * @param {Number} z z-coordinate of world-space position.
         * @author Will Eastcott
         */
        setPosition: function () {
            if (arguments.length === 1) {
                tempVec[0] = arguments[0][0];
                tempVec[1] = arguments[0][1];
                tempVec[2] = arguments[0][2];
            } else {
                tempVec[0] = arguments[0];
                tempVec[1] = arguments[1];
                tempVec[2] = arguments[2];
            }

            if (this._parent === null) {
                pc.math.vec3.copy(tempVec, this.localPosition);
            } else {
                var parentWtm = this._parent.getWorldTransform();
                pc.math.mat4.invert(parentWtm, tempMat);
                pc.math.mat4.multiplyVec3(tempVec, 1, tempMat, this.localPosition);
            }
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setRotation
         * @description Sets the world space rotation of the specified graph node using
         * a quaternion.
         * @param {pc.math.vec3} rot World space rotation (xyz) of graph node.
         * @author Will Eastcott
         */
        /**
         * @function
         * @name pc.scene.GraphNode#setRotation^2
         * @description Sets the world space rotation of the specified graph node using
         * the 4 components of a quaternion.
         * @param {Number} x X component of world space quaternion rotation.
         * @param {Number} y Y component of world space quaternion rotation.
         * @param {Number} z Z component of world space quaternion rotation.
         * @param {Number} w W component of world space quaternion rotation.
         * @author Will Eastcott
         */
        setRotation: function () {
            if (arguments.length === 1) {
                tempQuatA[0] = arguments[0][0];
                tempQuatA[1] = arguments[0][1];
                tempQuatA[2] = arguments[0][2];
                tempQuatA[3] = arguments[0][3];
            } else {
                tempQuatA[0] = arguments[0];
                tempQuatA[1] = arguments[1];
                tempQuatA[2] = arguments[2];
                tempQuatA[3] = arguments[3];
            }

            if (this._parent === null) {
                pc.math.quat.copy(tempQuatA, this.localRotation);
            } else {
                var parentRot = this._parent.getRotation();
                pc.math.quat.invert(parentRot, tempQuatB);
                pc.math.quat.multiply(tempQuatB, tempQuatA, this.localRotation);
            }
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setEulerAngles
         * @description Sets the world space orientation of the specified graph node
         * using Euler angles. Angles are specified in degress in XYZ order.
         * @param {pc.math.vec3} angles Euler angles in degrees (XYZ order).
         * @author Will Eastcott
         */
        /**
         * @function
         * @name pc.scene.GraphNode#setEulerAngles^2
         * @description Sets the world space orientation of the specified graph node
         * using Euler angles. Angles are specified in degress in XYZ order.
         * @param {Number} ex Rotation around world space X axis in degrees.
         * @param {Number} ey Rotation around world space Y axis in degrees.
         * @param {Number} ez Rotation around world space Z axis in degrees.
         * @author Will Eastcott
         */
        setEulerAngles: function () {
            if (arguments.length === 1) {
                tempVec[0] = arguments[0][0];
                tempVec[1] = arguments[0][1];
                tempVec[2] = arguments[0][2];
            } else {
                tempVec[0] = arguments[0];
                tempVec[1] = arguments[1];
                tempVec[2] = arguments[2];
            }

            pc.math.quat.fromEulerXYZ(tempVec[0], tempVec[1], tempVec[2], this.localRotation);

            if (this._parent !== null) {
                var parentRot = this._parent.getRotation();
                pc.math.quat.invert(parentRot, tempQuatA);
                pc.math.quat.multiply(tempQuatA, this.localRotation, this.localRotation);
            }
            this.dirtyLocal = true;
        },

        /**
         * @function 
         * @name pc.scene.GraphNode#addChild
         * @description Add a new child to the child list and update the parent value of the child node
         * @param {pc.scene.GraphNode} node The new child to add
         */
        addChild: function (node) {
            if (node.getParent() !== null) {
                throw new Error("GraphNode is already parented");
            }

            this._children.push(node);
            node._parent = this;

            // The child (plus subhierarchy) will need world transforms to be recalculated
            node.dirtyWorld = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#removeChild
         * @description Remove the node from the child list and update the parent value of the child.
         * @param {pc.scene.GraphNode} node The node to remove
         */
        removeChild: function (child) {
            var i;
            var length = this._children.length;

            // Clear parent
            child._parent = null;
            
            // Remove from child list
            for(i = 0; i < length; ++i) {
                if(this._children[i] === child) {
                    this._children.splice(i, 1);
                    return;
                }
            }
        },

        /**
         * @function 
         * @name pc.scene.GraphNode#addLabel
         * @description Add a string label to this graph node, labels can be used to group
         * and filter nodes. For example, the 'enemies' label could be applied to a group of NPCs
         * who are enemies.
         * @param {String} label The label to apply to this graph node.
         */
        addLabel: function (label) {
            this._labels[label] = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getLabels
         * @description Get an array of all labels applied to this graph node.
         * @returns {Array} An array of all labels.
         */
        getLabels: function () {
            return Object.keys(this._labels);
        },

        /**
         * @function
         * @name pc.scene.GraphNode#hasLabel
         * @description Test if a label has been applied to this graph node.
         * @param {String} label The label to test for.
         * @returns {Boolean} True if the label has been added to this GraphNode.
         */
        hasLabel: function (label) {
            return !!this._labels[label];
        },

        /**
         * @function
         * @name pc.scene.GraphNode#removeLabel
         * @description Remove label from this graph node.
         * @param {String} label The label to remove from this node.
         */
        removeLabel: function (label) {
            delete this._labels[label];
        },

        /**
         * @function
         * @name pc.scene.GraphNode#findByLabel
         * @description Find all graph nodes from the root and all descendants with the label.
         * @param {String} label The label to search for.
         * @param {Array} results An array to store the results in.
         * @returns The array passed in or a new array of results.
         */
        findByLabel: function (label, results) {
            var i, length = this._children.length;
            results = results || [];
            
            if(this.hasLabel(label)) {
                results.push(this);
            }

            for(i = 0; i < length; ++i) {
                results = this._children[i].findByLabel(label, results);
            }
            
            return results;
        },

        sync: function () {
            if (this.dirtyLocal) {
                pc.math.mat4.compose(this.localPosition, this.localRotation, this.localScale, this.localTransform);

                this.dirtyLocal = false;
                this.dirtyWorld = true;
            }

            if (this.dirtyWorld) {
                if (this._parent === null) { 
                    pc.math.mat4.copy(this.localTransform, this.worldTransform);
                } else {
                    pc.math.mat4.multiply(this._parent.worldTransform, this.localTransform, this.worldTransform);
                }

                this.dirtyWorld = false;

                for (var i = 0, len = this._children.length; i < len; i++) {
                    this._children[i].dirtyWorld = true;
                }
            }
        },

        /**
         * @function
         * @name pc.scene.GraphNode#syncHierarchy
         * @description Updates the world transformation matrices at this node and all of its descendants.
         * @author Will Eastcott
         */
        syncHierarchy: function () {
            this.sync();

            // Sync subhierarchy
            for (var i = 0, len = this._children.length; i < len; i++) {
                this._children[i].syncHierarchy();
            }
        },

        /**
         * @function
         * @name pc.scene.GraphNode#lookAt
         * @description Reorients the graph node so that the negative z axis points towards the target.
         * @param {pc.math.vec3} target The world space coordinate to 'look at'.
         * @param {pc.math.vec3} up The up vector for the look at transform. If left unspecified,
         * this is set to the world space y axis.
         * @author Will Eastcott
         */
        lookAt: function () {
            var target, up;

            switch (arguments.length) {
                case 1:
                    target = arguments[0];
                    up = pc.math.vec3.yaxis;
                    break;
                case 2:
                    target = arguments[0];
                    up = arguments[1];
                    break;
                case 3:
                    target = tempVec;
                    target[0] = arguments[0];
                    target[1] = arguments[1];
                    target[2] = arguments[2];
                    up = pc.math.vec3.yaxis;
                    break;
            }

            var m = pc.math.mat4.makeLookAt(this.localPosition, target, up);
            pc.math.quat.fromMat4(m, this.localRotation);
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#translate
         * @description Translates the graph node in world space by the specified translation vector.
         * @param {pc.math.vec3} translation The world space translation vector to apply.
         * @author Will Eastcott
         */
        /**
         * @function
         * @name pc.scene.GraphNode#translate^2
         * @description Translates the graph node in world space by the specified translation vector.
         * @param {Number} x x-component of the translation vector.
         * @param {Number} y y-component of the translation vector.
         * @param {Number} z z-component of the translation vector.
         * @author Will Eastcott
         */
        translate: function () {
            var x = 0, y = 0, z = 0;

            switch (arguments.length) {
                case 1:
                    x = arguments[0][0];
                    y = arguments[0][1];
                    z = arguments[0][2];
                    break;
                case 3:
                    x = arguments[0];
                    y = arguments[1];
                    z = arguments[2];
                    break;
            }
            var pos = this.getPosition();
            this.setPosition(pos[0] + x, pos[1] + y, pos[2] + z);
        },

        /**
         * @function
         * @name pc.scene.GraphNode#translateLocal
         * @description Translates the graph node in local space by the specified translation vector.
         * @param {pc.math.vec3} translation The local space translation vector to apply.
         * @author Will Eastcott
         */
        /**
         * @function
         * @name pc.scene.GraphNode#translateLocal^2
         * @description Translates the graph node in local space by the specified translation vector.
         * @param {Number} x x-component of the translation vector.
         * @param {Number} y y-component of the translation vector.
         * @param {Number} z z-component of the translation vector.
         * @author Will Eastcott
         */
        translateLocal: function () {
            switch (arguments.length) {
                case 1:
                    tempVec[0] = arguments[0][0];
                    tempVec[1] = arguments[0][1];
                    tempVec[2] = arguments[0][2];
                    break;
                case 3:
                    tempVec[0] = arguments[0];
                    tempVec[1] = arguments[1];
                    tempVec[2] = arguments[2];
                    break;
            }

            pc.math.quat.transformVector(this.getLocalRotation(), tempVec, tempVec);
            pc.math.vec3.add(this.localPosition, tempVec, this.localPosition);
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#rotate
         * @description Rotates the graph node in world space by the specified Euler angles.
         * Eulers are specified in degrees in XYZ order.
         * @param {pc.math.vec3} rot World space rotation (xyz) of graph node.
         * @author Will Eastcott
         */
        /**
         * @function
         * @name pc.scene.GraphNode#rotate^2
         * @description Rotates the graph node in world space by the specified Euler angles.
         * Eulers are specified in degrees in XYZ order.
         * @param {Number} ex Rotation around world space X axis in degrees.
         * @param {Number} ey Rotation around world space Y axis in degrees.
         * @param {Number} ez Rotation around world space Z axis in degrees.
         * @author Will Eastcott
         */
        rotate: function () {
            var x, y, z;
            if (arguments.length === 3) {
                x = arguments[0];
                y = arguments[1];
                z = arguments[2];
            } else {
                x = arguments[0][0];
                y = arguments[0][1];
                z = arguments[0][2];
            }

            pc.math.quat.fromEulerXYZ(x, y, z, tempQuatA);

            if (this._parent === null) {
                pc.math.quat.multiply(tempQuatA, this.localRotation, this.localRotation);
            } else {
                var worldRot = this.getRotation();
                var parentRot = this._parent.getRotation();

                pc.math.quat.invert(parentRot, tempQuatB);
                pc.math.quat.multiply(tempQuatB, tempQuatA, tempQuatA);
                pc.math.quat.multiply(tempQuatA, worldRot, this.localRotation);
            }
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#rotateLocal
         * @description Rotates the graph node in local space by the specified Euler angles.
         * Eulers are specified in degrees in XYZ order.
         * @param {pc.math.vec3} rot Local space rotation (xyz) of graph node.
         * @author Will Eastcott
         */
        /**
         * @function
         * @name pc.scene.GraphNode#rotateLocal^2
         * @description Rotates the graph node in local space by the specified Euler angles.
         * Eulers are specified in degrees in XYZ order.
         * @param {Number} ex Rotation around local space X axis in degrees.
         * @param {Number} ey Rotation around local space Y axis in degrees.
         * @param {Number} ez Rotation around local space Z axis in degrees.
         * @author Will Eastcott
         */
        rotateLocal: function () {
            var x, y, z;
            if (arguments.length === 3) {
                x = arguments[0];
                y = arguments[1];
                z = arguments[2];
            } else {
                x = arguments[0][0];
                y = arguments[0][1];
                z = arguments[0][2];
            }

            pc.math.quat.fromEulerXYZ(x, y, z, tempQuatA);
            pc.math.quat.multiply(this.localRotation, tempQuatA, this.localRotation);
            this.dirtyLocal = true;
        }
    });

    return {
        GraphNode: GraphNode
    }; 
}());