pc.extend(pc.scene, function () {
    
    /**
     * @name pc.scene.GraphNode
     * @class A node.
     * @param {String} [name] Non-unique human readable name
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

    GraphNode.prototype.clone = function () {
        var clone = new pc.scene.GraphNode();

        // GraphNode
        clone.setName(this.getName());
        clone.setLocalTransform(pc.math.mat4.clone(this.getLocalTransform()));
        clone._graphId = this._graphId;

        return clone;
    };

    /**
     * @function
     * @name pc.scene.GraphNode#addGraphId
     * @description The Graph ID is used to patch up nodes while loading graph data from files. A Graph ID is added during the loading process and should 
     * be removed again by called removeGraphId() once the loading is complete.
     * @param {String} id The ID from the data file which is added to the node temporarily
     */
    GraphNode.prototype.addGraphId = function (id) {
        this._graphId = id;
    }
    
    /**
     * @function
     * @name pc.scene.GraphNode#removeGraphId
     * @description The Graph ID is used to patch up nodes while loading graph data from files. A Graph ID is added during the loading process by calling addGraphId() and should 
     * be removed again by called removeGraphId() once the loading is complete.
     */
    GraphNode.prototype.removeGraphId = function () {
        delete this._graphId;
    }
    
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
    GraphNode.prototype.find = function (attr, value) {
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
    };
    
    /**
     * @function
     * @name pc.scene.GraphNode#findOne
     * @description @see pc.scene.GraphNode#find, but this will only return the first GraphNode that it finds
     * @param {String} attr The property or function name to search using
     * @param {String} value The value to search for
     * @returns {pc.fw.GraphNode} A single GraphNode
     */
    GraphNode.prototype.findOne = function(attr, value) {
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
    }
    
    /**
     * @function
     * @name pc.scene.GraphNode#findByName
     * @description Get the first node found in the graph with the name
     * @returns {pc.scene.GraphNode}
     * @author Will Eastcott
     */
    GraphNode.prototype.findByName = function (name) {
        if (this._name === name) return this;

        for (var i = 0; i < this._children.length; i++) {
            var found = this._children[i].findByName(name);
            if (found !== null) return found;
        }
        return null;
    };

    /**
     * @function
     * @name pc.scene.GraphNode#findByGraphId
     * @description
     * @returns {pc.scene.GraphNode}
     */
    GraphNode.prototype.findByGraphId = function (id) {
        if (this._graphId === id) return this;

        for (var i = 0; i < this._children.length; i++) {
            var found = this._children[i].findByGraphId(id);
            if (found !== null) return found;
        }
        return null;

    };
    
    /**
     * @function
     * @name pc.scene.GraphNode#getRoot
     * @description Get the highest ancestor node from this one.
     * @return {pc.scene.GraphNode} The root node
     */
    GraphNode.prototype.getRoot = function () {
        var parent = this.getParent()
        if(!parent) {
            return this;
        }
        
        while(parent.getParent()) {
            parent = parent.getParent();
        }
        return parent;
    };

    /**
     * @function
     * @name pc.scene.GraphNode#getParent
     * @description Get the parent GraphNode
     * @returns {pc.scene.GraphNode} The parent node
     */
    GraphNode.prototype.getParent = function () {
        return this._parent;
    };
    
    /**
     * @function
     * @name pc.scene.GraphNode#getChildren
     * @description Get the children of this GraphNode
     * @returns {Array}
     * @author Will Eastcott
     */
    GraphNode.prototype.getChildren = function () {
        return this._children;
    };

    /**
     * @function
     * @name pc.scene.GraphNode#getLocalTransform
     * @description Get the local transform matrix for this GraphNode
     * @returns {Array}
     * @author Will Eastcott
     */
    GraphNode.prototype.getLocalTransform = function () {
        return this._ltm;
    };

    /**
     * @function
     * @name pc.scene.GraphNode#getName
     * @description Get the human-readable name for this GraphNode. Note the name is not guaranteed to be unique.
     * @returns {String}
     * @author Will Eastcott
     */
    GraphNode.prototype.getName = function () {
        return this._name;
    };

    /**
     * @function
     * @name pc.scene.GraphNode#getWorldTransform
     * @description Get the world transformation matrix for this GraphNode
     * @returns {Array}
     * @author Will Eastcott
     */
    GraphNode.prototype.getWorldTransform = function () {
        return this._wtm;
    };
    
    /**
     * @function
     * @name pc.scene.GraphNode#setParent
     * @description Set the parent node of this node. Note, this does not update the children of the parent
     * @param node {pc.scene.GraphNode} The node to use as the parent
     */
    GraphNode.prototype.setParent = function (node) {
        this._parent = node;
    };
    
    /**
     * @function
     * @name pc.scene.GraphNode#setChildren
     * @description Set the child array of this node. Note, this does not update the parent value of the children.
     * @param {Array} children
     * @author Will Eastcott
     */
    GraphNode.prototype.setChildren = function (children) {
        this._children = children;
    };

    /**
     * @function
     * @name pc.scene.GraphNode#setLocalTransform
     * @description
     * @param {Array} ltm
     * @author Will Eastcott
     */
    GraphNode.prototype.setLocalTransform = function (ltm) {
        this._ltm = ltm;
    };
    
    /**
     * @function
     * @name pc.scene.GraphNode#setName
     * @description
     * @param {String} name
     * @author Will Eastcott
     */
    GraphNode.prototype.setName = function (name) {
        this._name = name;
    };

    /**
     * @function 
     * @name pc.scene.GraphNode#addChild
     * @description Add a new child to the child list and update the parent value of the child node
     * @param {pc.scene.GraphNode} node The new child to add
     */
    GraphNode.prototype.addChild = function (node) {
        if(node.getParent() != null) {
            throw new Error("GraphNode is already parented")
        }

        this._children.push(node);
        node.setParent(this);
    }
    
    /**
     * @function
     * @name pc.scene.GraphNode#removeChild
     * @description Remove the node from the child list and update the parent value of the child.
     * @param {pc.scene.GraphNode} node The node to remove
     */
    GraphNode.prototype.removeChild = function (child) {
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
    }
    
    /**
     * @function 
     * @name pc.scene.GraphNode#addLabel
     * @description Add a string label to this GraphNode, labels can be used to group and filter nodes. e.g. The 'enemies' label could be applied to a group of NPCs who are enemies
     * @param {String} label The label to apply to this GraphNode
     */
    GraphNode.prototype.addLabel = function (label) {
        this._labels[label] = true;
    };
    
    /**
     * @function
     * @name pc.scene.GraphNode#getLabels
     * @description Get a list of all labels applied to this GraphNode
     * @param {Array} A list of all labels
     */
    GraphNode.prototype.getLabels = function () {
        return Object.keys(this._labels);
    };
    
    /**
     * @function
     * @name pc.scene.GraphNode#hasLabel
     * @description Test if a label has been applied to this GraphNode
     * @param label {String} The label to test for
     * @returns {Boolean} True if the label has been added to this GraphNode
     */
    GraphNode.prototype.hasLabel = function (label) {
        return !!this._labels[label];
    };
    
    /**
     * @function
     * @name pc.scene.GraphNode#removeLabel
     * @description Remove label from this GraphNode
     * @param label {String} The label to remove from this node
     */
    GraphNode.prototype.removeLabel = function (label) {
        delete this._labels[label];
    };
    
    /**
     * @function
     * @name pc.scene.GraphNode#findByLabel
     * @description Find all GraphNodes from the root and all descendants with the label
     * @param label {String} The label to search for
     * @param [results] {Array} An array to store the results in
     * @returns The array passed in or a new array of results 
     */
    GraphNode.prototype.findByLabel = function (label, results) {
        var i, length = this._children.length;
        results = results || [];
        
        if(this.hasLabel(label)) {
            results.push(this);
        }
        
        for(i = 0; i < length; ++i) {
            results = this._children[i].findByLabel(label, results);
        }
        
        return results;
    };
    
    /**
     * @function
     * @name pc.scene.GraphNode#syncHierarchy
     * @description
     * @param {pc.math.mat4} [transform] Parent transform to sync hierarchy to. Defaults to identity.
     * @author Will Eastcott
     */
    GraphNode.prototype.syncHierarchy = function (transform) {
        function _syncHierarchy(node, parentTransform) {
            // Now calculate this nodes world space transform
            pc.math.mat4.multiply(parentTransform, node._ltm, node._wtm);

            // Sync subhierarchy
            for (var i = 0, len = node._children.length; i < len; i++) {
                _syncHierarchy(node._children[i], node._wtm);
            }
        }
    
        transform = transform || pc.math.mat4.create();
        _syncHierarchy(this, transform);
    };

    return {
        GraphNode: GraphNode
    }; 
}());