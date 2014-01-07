pc.extend(pc.scene, function () {
    /**
     * @name pc.scene.GraphNode
     * @class A hierarchical scene node.
     * @param {String} name Non-unique, human readable name.
     * @property {pc.Vec3} right Vector representing the X direction of the node in world space (read only).
     * @property {pc.Vec3} up Vector representing the Y direction of the node in world space (read only).
     * @property {pc.Vec3} forward Vector representing the negative Z direction of the node in world space (read only).
     */
    var GraphNode = function GraphNode(name) {
        this.name = name || "Untitled"; // Non-unique human readable name
        this._labels = {};

        // Local-space properties of transform (only first 3 are settable by the user)
        this.localPosition = new pc.Vec3(0, 0, 0);
        this.localRotation = new pc.Quat(0, 0, 0, 1);
        this.localScale = new pc.Vec3(1, 1, 1);
        this.localEulerAngles = new pc.Vec3(0, 0, 0); // Only calculated on request

        // World-space properties of transform
        this.position = new pc.Vec3(0, 0, 0);
        this.rotation = new pc.Quat(0, 0, 0, 1);
        this.eulerAngles = new pc.Vec3(0, 0, 0);

        this.localTransform = new pc.Mat4();
        this.dirtyLocal = false;

        this.worldTransform = new pc.Mat4();
        this.dirtyWorld = false;

        this._right = new pc.Vec3();
        this._up = new pc.Vec3();
        this._forward = new pc.Vec3();

        this._parent = null;
        this._children = [];
    };

    Object.defineProperty(GraphNode.prototype, 'right', {
        get: function() {
            return this.getWorldTransform().getX(this._right).normalize();
        }
    });

    Object.defineProperty(GraphNode.prototype, 'up', {
        get: function() {
            return this.getWorldTransform().getY(this._up).normalize();
        }
    });

    Object.defineProperty(GraphNode.prototype, 'forward', {
        get: function() {
            return this.getWorldTransform().getZ(this._forward).normalize().scale(-1);
        }
    });

    Object.defineProperty(GraphNode.prototype, 'forwards', {
        get: function() {
            console.log('pc.GraphNode#forwards is DEPRECATED. Use pc.GraphNode#forward instead.');
            return this.forward;
        }
    });

    pc.extend(GraphNode.prototype, {

        _cloneInternal: function (clone) {
            clone.name = this.name;
            clone._labels = pc.extend(this._lables, {});

            clone.localPosition.copy(this.localPosition);
            clone.localRotation.copy(this.localRotation);
            clone.localScale.copy(this.localScale);
            clone.localEulerAngles.copy(this.localEulerAngles);

            clone.position.copy(this.position);
            clone.rotation.copy(this.rotation);
            clone.eulerAngles.copy(this.eulerAngles);

            clone.localTransform.copy(this.localTransform);
            clone.dirtyLocal = clone.dirtyLocal;

            clone.worldTransform.copy(this.worldTransform);
            clone.dirtyWorld = clone.dirtyWorld;
        },

        clone: function () {
            var clone = new pc.scene.GraphNode();
            this._cloneInternal(clone);
            return clone;
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
            if (this.name === name) return this;

            for (var i = 0; i < this._children.length; i++) {
                var found = this._children[i].findByName(name);
                if (found !== null) return found;
            }
            return null;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getRoot
         * @description Get the highest ancestor node from this graph node.
         * @return {pc.scene.GraphNode} The root node of the hierarchy to which this node belongs.
         * @example
         * var root = this.entity.getRoot();
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
         * @example
         * var parent = this.entity.getParent();
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
         * @example
         * var children = this.entity.getChildren();
         * for (i = 0; i < children.length; i++) {
         * // children[i]
         * }
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
         * node, use {@link pc.scene.GraphNode#setEulerAngles}.
         * @returns {pc.Vec3} The world space rotation of the graph node in Euler angle form.
         * @author Will Eastcott
         * @example
         * var angles = this.entity.getEulerAngles(); // [0,0,0]
         * angles[1] = 180; // rotate the entity around Y by 180 degrees
         * this.entity.setEulerAngles(angles);
         */
        getEulerAngles: function () {
            this.getWorldTransform().toEulers(this.eulerAngles);
            return this.eulerAngles;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getLocalEulerAngles
         * @description Get the rotation in local space for the specified GraphNode. The rotation
         * is returned as eurler angles in a 3-dimensional vector where the order is XYZ. The 
         * returned vector should be considered read-only. To update the local rotation, use 
         * {@link pc.scene.GraphNode#setLocalEulerAngles}.
         * @returns {pc.Vec3} The local space rotation of the graph node as euler angles in XYZ order.
         * @author Will Eastcott
         * @example
         * var angles = this.entity.getLocalEulerAngles();
         * angles[1] = 180;
         * this.entity.setLocalEulerAngles(angles);
         */
        getLocalEulerAngles: function () {
            this.localRotation.toEulers(this.localEulerAngles);
            return this.localEulerAngles;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getLocalPosition
         * @description Get the position in local space for the specified GraphNode. The position
         * is returned as a 3-dimensional vector. The returned vector should be considered read-only.
         * To update the local position, use {@link pc.scene.GraphNode#setLocalPosition}.
         * @returns {pc.Vec3} The local space position of the graph node.
         * @author Will Eastcott
         * @example
         * var position = this.entity.getLocalPosition();
         * position[0] += 1; // move the entity 1 unit along x.
         * this.entity.setLocalPosition(position);
         */
        getLocalPosition: function () {
            return this.localPosition;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getLocalRotation
         * @description Get the rotation in local space for the specified GraphNode. The rotation
         * is returned as a quaternion. The returned quaternion should be considered read-only.
         * To update the local rotation, use {@link pc.scene.GraphNode#setLocalRotation}.
         * @returns {pc.Quat} The local space rotation of the graph node as a quaternion.
         * @author Will Eastcott
         * @example
         * var rotation = this.entity.getLocalRotation();
         */
        getLocalRotation: function () {
            return this.localRotation;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getLocalScale
         * @description Get the scale in local space for the specified GraphNode. The scale
         * is returned as a 3-dimensional vector. The returned vector should be considered read-only.
         * To update the local scale, use {@link pc.scene.GraphNode#setLocalScale}.
         * @returns {pc.Vec3} The local space scale of the graph node.
         * @author Will Eastcott
         * @example
         * var scale = this.entity.getLocalScale();
         * scale.x = 100;
         * this.entity.setLocalScale(scale);
         */
        getLocalScale: function () {
            return this.localScale;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getLocalTransform
         * @description Get the local transform matrix for this graph node. This matrix
         * is the transform relative to the node's parent's world transformation matrix.
         * @returns {pc.Mat4} The node's local transformation matrix.
         * @author Will Eastcott
         * @example
         * var transform = this.entity.getLocalTransform();
         */
        getLocalTransform: function () {
            if (this.dirtyLocal) {
                this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

                this.dirtyLocal = false;
                this.dirtyWorld = true;
            }
            return this.localTransform;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getName
         * @description Get the human-readable name for this graph node. Note the name
         * is not guaranteed to be unique. For Entities, this is the name that is set in the PlayCanvas Designer.
         * @returns {String} The name of the node.
         * @author Will Eastcott
         * @example
         * if (this.entity.getName() === "My Entity") {
         *     console.log("My Entity Found");
         * }
         */
        getName: function () {
            return this.name;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getPosition
         * @description Get the world space position for the specified GraphNode. The
         * value returned by this function should be considered read-only. In order to set
         * the world-space position of the graph node, use {@link pc.scene.GraphNode#setPosition}.
         * @returns {pc.Vec3} The world space position of the graph node.
         * @author Will Eastcott
         * @example 
         * var position = this.entity.getPosition();
         * position.x = 10;
         * this.entity.setPosition(position);
         */
        getPosition: function () {
            this.getWorldTransform().getTranslation(this.position);
            return this.position;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getRotation
         * @description Get the world space rotation for the specified GraphNode in quaternion
         * form. The value returned by this function should be considered read-only. In order 
         * to set the world-space rotation of the graph node, use {@link pc.scene.GraphNode#setRotation}.
         * @returns {pc.Quat} The world space rotation of the graph node as a quaternion.
         * @author Will Eastcott
         * @example
         * var rotation = this.entity.getRotation();
         */
        getRotation: function () {
            this.rotation.setFromMat4(this.getWorldTransform());
            return this.rotation;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getWorldTransform
         * @description Get the world transformation matrix for this graph node.
         * @returns {pc.Mat4} The node's world transformation matrix.
         * @author Will Eastcott
         * @example
         * var transform = this.entity.getWorldTransform();
         */
        getWorldTransform: function () {
            var syncList = [];

            return function () {
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
            }
        }(),

        /**
         * @function
         * @name pc.scene.GraphNode#setLocalEulerAngles
         * @description Sets the local space rotation of the specified graph node using euler angles.
         * Eulers are interpreted in XYZ order. Eulers must be specified in degrees.
         * @param {pc.Vec3} e vector containing euler angles in XYZ order.
         * @author Will Eastcott
         * @example
         * var angles = new pc.Vec3(0, 90, 0);
         * this.entity.setLocalEulerAngles(angles); // Set rotation of 90 degress around y-axis.
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
         * @example
         * this.entity.setLocalEulerAngles(0, 90, 0); // Set rotation of 90 degress around y-axis.
         */
        setLocalEulerAngles: function () {
            var ex, ey, ez;
            switch (arguments.length) {
                case 1:
                    ex = arguments[0].x;
                    ey = arguments[0].y;
                    ez = arguments[0].z;
                    break;
                case 3:
                    ex = arguments[0];
                    ey = arguments[1];
                    ez = arguments[2];
                    break;
            }

            this.localRotation.setFromEulerAngles(ex, ey, ez);
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setLocalPosition
         * @description Sets the local space position of the specified graph node.
         * @param {pc.Vec3} pos position vector of graph node in local space.
         * @author Will Eastcott
         * @example
         * var pos = new pc.Vec3(0, 10, 0);
         * this.entity.setLocalPosition(pos)
         */
        /**
         * @function
         * @name pc.scene.GraphNode#setLocalPosition^2
         * @description Sets the local space position of the specified graph node.
         * @param {Number} x x-coordinate of local-space position.
         * @param {Number} y y-coordinate of local-space position.
         * @param {Number} z z-coordinate of local-space position.
         * @author Will Eastcott
         * @example
         * this.entity.setLocalPosition(0, 10, 0);
         */
        setLocalPosition: function () {
            if (arguments.length === 1) {
                this.localPosition.copy(arguments[0]);
            } else {
                this.localPosition.set(arguments[0], arguments[1], arguments[2]);
            }
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setLocalRotation
         * @description Sets the local space rotation of the specified graph node.
         * @param {pc.Quat} q quaternion representing rotation of graph node in local space.
         * @author Will Eastcott
         * var q = pc.Quat();
         * this.entity.setLocalRotation(q);
         */
        /**
         * @function
         * @name pc.scene.GraphNode#setLocalRotation^2
         * @description Sets the local space rotation of the specified graph node.
         * @param {Number} x X component of local space quaternion rotation.
         * @param {Number} y Y component of local space quaternion rotation.
         * @param {Number} z Z component of local space quaternion rotation.
         * @param {Number} w W component of local space quaternion rotation.
         * @author Will Eastcott
         * @example
         * // Set to the identity quaternion
         * this.entity.setLocalRotation(0, 0, 0, 1);
         */
        setLocalRotation: function (q) {
            if (arguments.length === 1) {
                this.localRotation.copy(arguments[0]);
            } else {
                this.localRotation.set(arguments[0], arguments[1], arguments[2], arguments[3]);
            }
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setLocalScale
         * @description Sets the local space scale factor of the specified graph node.
         * @param {pc.Vec3} scale xyz-scale of graph node in local space.
         * @author Will Eastcott
         * @example
         * var scale = new pc.Vec3(10, 10, 10);
         * this.entity.setLocalScale(scale);
         */
        /**
         * @function
         * @name pc.scene.GraphNode#setLocalScale^2
         * @description Sets the local space scale factor of the specified graph node.
         * @param {Number} x x-coordinate of local-space scale.
         * @param {Number} y y-coordinate of local-space scale.
         * @param {Number} z z-coordinate of local-space scale.
         * @author Will Eastcott
         * @example
         * this.entity.setLocalScale(10, 10, 10);
         */
        setLocalScale: function () {
            if (arguments.length === 1) {
                this.localScale.copy(arguments[0]);
            } else {
                this.localScale.set(arguments[0], arguments[1], arguments[2]);
            }
            this.dirtyLocal = true;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setName
         * @description Sets the non-unique name for this graph node.
         * @param {String} name The name for the node.
         * @author Will Eastcott
         * @example
         * this.entity.setName("My Entity");
         */
        setName: function (name) {
            this.name = name;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setPosition
         * @description Sets the world space position of the specified graph node.
         * @param {pc.Vec3} position world space position (xyz) of graph node.
         * @author Will Eastcott
         * @example
         * var position = new pc.Vec3(0, 10, 0);
         * this.entity.setPosition(position);
         */
        /**
         * @function
         * @name pc.scene.GraphNode#setPosition^2
         * @description Sets the world space position of the specified graph node.
         * @param {Number} x x-coordinate of world-space position.
         * @param {Number} y y-coordinate of world-space position.
         * @param {Number} z z-coordinate of world-space position.
         * @author Will Eastcott
         * @example
         * this.entity.setPosition(0, 10, 0);
         */
        setPosition: function () {
            var position = new pc.Vec3();
            var invParentWtm = new pc.Mat4();

            return function () {
                if (arguments.length === 1) {
                    position.copy(arguments[0]);
                } else {
                    position.set(arguments[0], arguments[1], arguments[2]);
                }

                if (this._parent === null) {
                    this.localPosition.copy(position);
                } else {
                    invParentWtm.copy(this._parent.getWorldTransform()).invert();
                    invParentWtm.transformPoint(position, this.localPosition);
                }
                this.dirtyLocal = true;
            };
        }(),

        /**
         * @function
         * @name pc.scene.GraphNode#setRotation
         * @description Sets the world space rotation of the specified graph node using
         * a quaternion.
         * @param {pc.Quat} rot World space rotation (xyz) of graph node.
         * @author Will Eastcott
         * @example
         * var q = new pc.Quat();
         * this.entity.setRotation(q);
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
         * @example
         * this.entity.setRotation(0, 0, 0, 1);
         */
        setRotation: function () {
            var rotation = new pc.Quat();
            var invParentRot = new pc.Quat();

            return function () {
                if (arguments.length === 1) {
                    rotation.copy(arguments[0]);
                } else {
                    rotation.set(arguments[0], arguments[1], arguments[2], arguments[3]);
                }

                if (this._parent === null) {
                    this.localRotation.copy(rotation);
                } else {
                    var parentRot = this._parent.getRotation();
                    invParentRot.copy(parentRot).invert();
                    this.localRotation.copy(invParentRot).mul(rotation);
                }
                this.dirtyLocal = true;
            }
        }(),

        /**
         * @function
         * @name pc.scene.GraphNode#setEulerAngles
         * @description Sets the world space orientation of the specified graph node
         * using Euler angles. Angles are specified in degress in XYZ order.
         * @param {pc.Vec3} angles Euler angles in degrees (XYZ order).
         * @author Will Eastcott
         * @example
         * var angles = new pc.Vec3(0, 90, 0);
         * this.entity.setEulerAngles(angles);
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
         * @example
         * this.entity.setEulerAngles(0, 90, 0);
         */
        setEulerAngles: function () {
            var invParentRot = new pc.Quat();

            return function () {
                var ex, ey, ez;
                switch (arguments.length) {
                    case 1:
                        ex = arguments[0].x;
                        ey = arguments[0].y;
                        ez = arguments[0].z;
                        break;
                    case 3:
                        ex = arguments[0];
                        ey = arguments[1];
                        ez = arguments[2];
                        break;
                }

                this.localRotation.setFromEulerAngles(ex, ey, ez);

                if (this._parent !== null) {
                    var parentRot = this._parent.getRotation();
                    invParentRot.copy(parentRot).invert();
                    this.localRotation.mul2(invParentRot, this.localRotation);
                }
                this.dirtyLocal = true;
            }
        }(),

        /**
         * @function 
         * @name pc.scene.GraphNode#addChild
         * @description Add a new child to the child list and update the parent value of the child node
         * @param {pc.scene.GraphNode} node The new child to add
         * @example
         * var e = new pc.fw.Entity();
         * this.entity.addChild(e);
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
         * @example
         * var child = this.entity.getChildren()[0];
         * this.entity.removeChild(child);
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
         * 
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
                this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

                this.dirtyLocal = false;
                this.dirtyWorld = true;
            }

            if (this.dirtyWorld) {
                if (this._parent === null) { 
                    this.worldTransform.copy(this.localTransform);
                } else {
                    this.worldTransform.mul2(this._parent.worldTransform, this.localTransform);
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
         * @param {pc.Vec3} target The world space coordinate to 'look at'.
         * @param {pc.Vec3} [up] The up vector for the look at transform. If left unspecified,
         * this is set to the world space y axis.
         * @author Will Eastcott
         * @example
         * var position = ... // get position from somewhere
         * // Look at a position, use default 'up' of [0,1,0]
         * this.entity.lookAt(position);
         * // Use a custom up value
         * this.entity.lookAt(position, this.entity.up);
         * // Specify position as elements
         * this.entity.lookAt(0, 0, 0);
         */
        /**
         * @function
         * @name pc.scene.GraphNode#lookAt^2
         * @description Reorients the graph node so that the negative z axis points towards the target.
         * @param {Number} tx X-component of the world space coordinate to 'look at'.
         * @param {Number} ty Y-component of the world space coordinate to 'look at'.
         * @param {Number} tz Z-component of the world space coordinate to 'look at'.
         * @param {Number} [ux] X-component of the up vector for the look at transform. If left unspecified,
         * this is set to the world space y axis.
         * @param {Number} [uy] Y-component of the up vector for the look at transform. If left unspecified,
         * this is set to the world space y axis.
         * @param {Number} [uz] Z-component of the up vector for the look at transform. If left unspecified,
         * this is set to the world space y axis.
         * @author Will Eastcott
         * @example
         * // Look at the world space origin, use default 'up' of [0,1,0]
         * this.entity.lookAt(0, 0, 0);
         * // Look at 10, 10, 10 with an inverted up value
         * this.entity.lookAt(10, 10, 10, 0, -1, 0);
         */
        lookAt: function () {
            var matrix = new pc.Mat4();
            var target = new pc.Vec3();
            var up = new pc.Vec3();
            var rotation = new pc.Quat();

            return function () {
                switch (arguments.length) {
                    case 1:
                        target.copy(arguments[0]);
                        up.copy(pc.Vec3.up);
                        break;
                    case 2:
                        target.copy(arguments[0]);
                        up.copy(arguments[1]);
                        break;
                    case 3:
                        target.set(arguments[0], arguments[1], arguments[2]);
                        up.copy(pc.Vec3.up);
                        break;
                    case 6:
                        target.set(arguments[0], arguments[1], arguments[2]);
                        up.set(arguments[3], arguments[4], arguments[5]);
                        break;
                }

                matrix.lookAt(this.getPosition(), target, up);
                rotation.setFromMat4(matrix);
                this.setRotation(rotation);
            }
        }(),

        /**
         * @function
         * @name pc.scene.GraphNode#translate
         * @description Translates the graph node in world space by the specified translation vector.
         * @param {pc.Vec3} translation The world space translation vector to apply.
         * @author Will Eastcott
         * @example
         * var t = new pc.Vec3(10, 0, 0);
         * this.entity.translate(t);
         */
        /**
         * @function
         * @name pc.scene.GraphNode#translate^2
         * @description Translates the graph node in world space by the specified translation vector.
         * @param {Number} x x-component of the translation vector.
         * @param {Number} y y-component of the translation vector.
         * @param {Number} z z-component of the translation vector.
         * @author Will Eastcott
         * @example
         * this.entity.translate(10, 0, 0);
         */
        translate: function () {
            var translation = new pc.Vec3();

            return function () {
                switch (arguments.length) {
                    case 1:
                        translation.copy(arguments[0]);
                        break;
                    case 3:
                        translation.set(arguments[0], arguments[1], arguments[2]);
                        break;
                }

                translation.add(this.getPosition());
                this.setPosition(translation);
            }
        }(),

        /**
         * @function
         * @name pc.scene.GraphNode#translateLocal
         * @description Translates the graph node in local space by the specified translation vector.
         * @param {pc.Vec3} translation The local space translation vector to apply.
         * @author Will Eastcott
         * @example
         * var t = new pc.Vec3(10, 0, 0);
         * this.entity.translateLocal(t);
         */
        /**
         * @function
         * @name pc.scene.GraphNode#translateLocal^2
         * @description Translates the graph node in local space by the specified translation vector.
         * @param {Number} x x-component of the translation vector.
         * @param {Number} y y-component of the translation vector.
         * @param {Number} z z-component of the translation vector.
         * @author Will Eastcott
         * @example
         * this.entity.translateLocal(10, 0, 0);
         */
        translateLocal: function () {
            var translation = new pc.Vec3();

            return function () {
                switch (arguments.length) {
                    case 1:
                        translation.copy(arguments[0]);
                        break;
                    case 3:
                        translation.set(arguments[0], arguments[1], arguments[2]);
                        break;
                }

                this.localRotation.transformVector(translation, translation);
                this.localPosition.add(translation);
                this.dirtyLocal = true;
            }
        }(),

        /**
         * @function
         * @name pc.scene.GraphNode#rotate
         * @description Rotates the graph node in world space by the specified Euler angles.
         * Eulers are specified in degrees in XYZ order.
         * @param {pc.Vec3} rot World space rotation (xyz) of graph node.
         * @author Will Eastcott
         * @example
         * var r = new pc.Vec3(0, 90, 0);
         * this.entity.rotate(r);
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
         * @example
         * this.entity.rotate(0, 90, 0);
         */
        rotate: function () {
            var quaternion = new pc.Quat();
            var invParentRot = new pc.Quat();

            return function () {
                var ex, ey, ez;
                switch (arguments.length) {
                    case 1:
                        ex = arguments[0].x;
                        ey = arguments[0].y;
                        ez = arguments[0].z;
                        break;
                    case 3:
                        ex = arguments[0];
                        ey = arguments[1];
                        ez = arguments[2];
                        break;
                }

                quaternion.setFromEulerAngles(ex, ey, ez);

                if (this._parent === null) {
                    this.localRotation.mul2(quaternion, this.localRotation);
                } else {
                    var rot = this.getRotation();
                    var parentRot = this._parent.getRotation();

                    invParentRot.copy(parentRot).invert();
                    quaternion.mul2(invParentRot, quaternion);
                    this.localRotation.mul2(quaternion, rot);
                }

                this.dirtyLocal = true;
            }
        }(),

        /**
         * @function
         * @name pc.scene.GraphNode#rotateLocal
         * @description Rotates the graph node in local space by the specified Euler angles.
         * Eulers are specified in degrees in XYZ order.
         * @param {pc.Vec3} rot Local space rotation (xyz) of graph node.
         * @author Will Eastcott
         * @example
         * var r = new pc.Vec3(0, 90, 0);
         * this.entity.rotateLocal(r);
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
         * @example
         * this.entity.rotateLocal(0, 90, 0);
         */
        rotateLocal: function () {
            var quaternion = new pc.Quat();

            return function () {
                var ex, ey, ez;
                switch (arguments.length) {
                    case 1:
                        ex = arguments[0].x;
                        ey = arguments[0].y;
                        ez = arguments[0].z;
                        break;
                    case 3:
                        ex = arguments[0];
                        ey = arguments[1];
                        ez = arguments[2];
                        break;
                }

                quaternion.setFromEulerAngles(ex, ey, ez);

                this.localRotation.mul(quaternion);
                this.dirtyLocal = true;
            }
        }()
    });

    return {
        GraphNode: GraphNode
    }; 
}());