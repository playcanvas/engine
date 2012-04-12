pc.extend(pc.scene, function () {

    var identity = pc.math.mat4.create();

    /**
     * @name pc.scene.GraphNode
     * @class A node.
     * @param {String} name Non-unique, human readable name.
     */
    var GraphNode = function GraphNode(name) {
        this._name = name || ""; // Non-unique human readable name
        this._ltm = pc.math.mat4.create();
        this._wtm = pc.math.mat4.create();
        this._parent = null;
        this._children = [];
        this._labels = {};
        this._graphId = -1;
    };

    GraphNode.prototype = {

        _cloneInternal: function (clone) {
            clone._name = this._name;
            pc.math.mat4.copy(this._ltm, clone._ltm);
            pc.math.mat4.copy(this._wtm, clone._wtm);
            clone._labels = pc.extend(this._lables, {});
            clone._graphId = this._graphId;
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
            var parent = this.getParent()
            if(!parent) {
                return this;
            }
            
            while(parent.getParent()) {
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
         * @name pc.scene.GraphNode#getLocalPosition
         * @description Get the position in local space for the specified GraphNode.
         * @returns {pc.math.vec3} The local space position of the graph node.
         * @author Will Eastcott
         */
        getLocalPosition: function () {
            return this._ltm.subarray(12, 15);
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
            return this._ltm;
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
         * @name pc.scene.GraphNode#getWorldPosition
         * @description Get the position in world space for the specified GraphNode.
         * @returns {pc.math.vec3} The world space position of the graph node.
         * @author Will Eastcott
         */
        getWorldPosition: function () {
            return this._wtm.subarray(12, 15);
        },

        /**
         * @function
         * @name pc.scene.GraphNode#getWorldTransform
         * @description Get the world transformation matrix for this graph node.
         * @returns {pc.math.mat4} The node's world transformation matrix.
         * @author Will Eastcott
         */
        getWorldTransform: function () {
            return this._wtm;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setParent
         * @description Set the parent node of this node. Note, this does not update the children of the parent
         * @param {pc.scene.GraphNode} node The node to use as the parent
         */
        setParent: function (node) {
            this._parent = node;
        },
    
        /**
         * @function
         * @name pc.scene.GraphNode#setChildren
         * @description Set the child array of this node. Note, this does not update the parent value of the children.
         * @param {Array} children 
         * @author Will Eastcott
         */
        setChildren: function (children) {
            this._children = children;
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setLocalPosition
         * @description Sets the local space position of the specified graph node.
         * @param {pc.math.vec3} pos Position vector of graph node in local-space.
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
                this._ltm.set(arguments[0], 12);
            } else {
                this._ltm[12] = arguments[0];
                this._ltm[13] = arguments[1];
                this._ltm[14] = arguments[2];
            }
        },

        /**
         * @function
         * @name pc.scene.GraphNode#setLocalTransform
         * @description Sets the local space transform (relative to the parent graph node's
         * world transform) of the specified graph node.
         * @param {pc.math.mat4} ltm Local transformation matrix to apply.
         * @author Will Eastcott
         */
        setLocalTransform: function (ltm) {
            this._ltm = ltm;
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
         * @name pc.scene.GraphNode#addChild
         * @description Add a new child to the child list and update the parent value of the child node
         * @param {pc.scene.GraphNode} node The new child to add
         */
        addChild: function (node) {
            if(node.getParent() != null) {
                throw new Error("GraphNode is already parented")
            }

            this._children.push(node);
            node.setParent(this);
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
            child.setParent(null);
            
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

        /**
         * @function
         * @name pc.scene.GraphNode#syncHierarchy
         * @description Updates the world transformation matrices at this node and all of its descendants.
         * @author Will Eastcott
         */
        syncHierarchy: function () {
            function _syncHierarchy(node, parentTransform) {
                // Now calculate this nodes world space transform
                pc.math.mat4.multiply(parentTransform, node._ltm, node._wtm);

                // Sync subhierarchy
                for (var i = 0, len = node._children.length; i < len; i++) {
                    _syncHierarchy(node._children[i], node._wtm);
                }
            }

            _syncHierarchy(this, this._parent ? this._parent._wtm : identity);
        },

        /**
         * @function
         * @name pc.scene.GraphNode#lookAt
         * @description Reorients the graph node so that the z axis points towards the target.
         * @param {pc.math.vec3} target The world space coordinate to 'look at'.
         * @param {pc.math.vec3} up The up vector for the look at transform. If left unspecified,
         * this is set to the world space y axis.
         * @author Will Eastcott
         */
        lookAt: function (target, up) {
            up = up || pc.math.vec3.create(0, 1, 0);
            pc.math.mat4.makeLookAt(this.getLocalPosition(), target, up, this._ltm);
        },

        /**
         * @function
         * @name pc.scene.GraphNode#translate
         * @description Translates the graph node by the given translation vector.
         * @param {pc.math.vec3} translation The translation vector to apply.
         * @param {pc.scene.Space} space The coordinate system that the translation is relative to.
         * In left unspecified, local space is assumed.
         * @author Will Eastcott
         */
        /**
         * @function
         * @name pc.scene.GraphNode#translate^2
         * @description Translates the graph node by the given translation vector.
         * @param {Number} x x-component of the translation vector.
         * @param {Number} y y-component of the translation vector.
         * @param {Number} z z-component of the translation vector.
         * @param {pc.scene.Space} space The coordinate system that the translation is relative to.
         * In left unspecified, local space is assumed.
         * @author Will Eastcott
         */
        translate: function () {
            var relativeTo;
            if (arguments.length >= 3) {
                relativeTo = arguments[3];
                if ((relativeTo === undefined) || (relativeTo === pc.scene.Space.LOCAL)) {
                    this._ltm[12] += arguments[0];
                    this._ltm[13] += arguments[1];
                    this._ltm[14] += arguments[2];
                }
            } else {
                relativeTo = arguments[1];
                if ((relativeTo === undefined) || (relativeTo === pc.scene.Space.LOCAL)) {
                    this._ltm[12] += arguments[0][0];
                    this._ltm[13] += arguments[0][1];
                    this._ltm[14] += arguments[0][2];
                }
            }
        },

        rotate: function (axis, angle) {
        
        }
    };

    return {
        GraphNode: GraphNode
    }; 
}());