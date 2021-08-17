import { EventHandler } from '../core/event-handler.js';
import { Tags } from '../core/tags.js';

import { Mat3 } from '../math/mat3.js';
import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { Vec3 } from '../math/vec3.js';

var scaleCompensatePosTransform = new Mat4();
var scaleCompensatePos = new Vec3();
var scaleCompensateRot = new Quat();
var scaleCompensateRot2 = new Quat();
var scaleCompensateScale = new Vec3();
var scaleCompensateScaleForParent = new Vec3();
var tmpMat4 = new Mat4();
var tmpQuat = new Quat();
var position = new Vec3();
var invParentWtm = new Mat4();
var rotation = new Quat();
var invParentRot = new Quat();
var matrix = new Mat4();
var target = new Vec3();
var up = new Vec3();

/**
 * @class
 * @name GraphNode
 * @augments EventHandler
 * @classdesc A hierarchical scene node.
 * @param {string} [name] - The non-unique name of the graph node, default is "Untitled".
 * @property {string} name The non-unique name of a graph node.
 * @property {Tags} tags Interface for tagging graph nodes. Tag based searches can be performed using the {@link GraphNode#findByTag} function.
 */
class GraphNode extends EventHandler {
    constructor(name) {
        super();

        this.name = typeof name === "string" ? name : "Untitled"; // Non-unique human readable name
        this.tags = new Tags(this);

        this._labels = {};

        // Local-space properties of transform (only first 3 are settable by the user)
        this.localPosition = new Vec3(0, 0, 0);
        this.localRotation = new Quat(0, 0, 0, 1);
        this.localScale = new Vec3(1, 1, 1);
        this.localEulerAngles = new Vec3(0, 0, 0); // Only calculated on request

        // World-space properties of transform
        this.position = new Vec3(0, 0, 0);
        this.rotation = new Quat(0, 0, 0, 1);
        this.eulerAngles = new Vec3(0, 0, 0);
        this._scale = null;

        this.localTransform = new Mat4();
        this._dirtyLocal = false;
        this._aabbVer = 0;

        // _frozen flag marks the node to ignore hierarchy sync entirely (including children nodes)
        // engine code automatically freezes and unfreezes objects whenever required
        // segregating dynamic and stationary nodes into subhierarchies allows to reduce sync time significantly
        this._frozen = false;

        this.worldTransform = new Mat4();
        this._dirtyWorld = false;

        this.normalMatrix = new Mat3();
        this._dirtyNormal = true;

        this._right = null;
        this._up = null;
        this._forward = null;

        this._parent = null;
        this._children = [];
        this._graphDepth = 0;

        this._enabled = true;
        this._enabledInHierarchy = false;

        this.scaleCompensation = false;
    }

    /**
     * @readonly
     * @name GraphNode#right
     * @type {Vec3}
     * @description The normalized local space X-axis vector of the graph node in world space.
     */
    get right() {
        if (!this._right) {
            this._right = new Vec3();
        }
        return this.getWorldTransform().getX(this._right).normalize();
    }

    /**
     * @readonly
     * @name GraphNode#up
     * @type {Vec3}
     * @description The normalized local space Y-axis vector of the graph node in world space.
     */
    get up() {
        if (!this._up) {
            this._up = new Vec3();
        }
        return this.getWorldTransform().getY(this._up).normalize();
    }

    /**
     * @readonly
     * @name GraphNode#forward
     * @type {Vec3}
     * @description The normalized local space negative Z-axis vector of the graph node in world space.
     */
    get forward() {
        if (!this._forward) {
            this._forward = new Vec3();
        }
        return this.getWorldTransform().getZ(this._forward).normalize().mulScalar(-1);
    }

    /**
     * @name GraphNode#enabled
     * @type {boolean}
     * @description Enable or disable a GraphNode. If one of the GraphNode's parents is disabled
     * there will be no other side effects. If all the parents are enabled then
     * the new value will activate / deactivate all the enabled children of the GraphNode.
     */
    get enabled() {
        // make sure to check this._enabled too because if that
        // was false when a parent was updated the _enabledInHierarchy
        // flag may not have been updated for optimization purposes
        return this._enabled && this._enabledInHierarchy;
    }

    set enabled(enabled) {
        if (this._enabled !== enabled) {
            this._enabled = enabled;

            if (!this._parent || this._parent.enabled)
                this._notifyHierarchyStateChanged(this, enabled);
        }
    }

    /**
     * @readonly
     * @name GraphNode#parent
     * @type {GraphNode}
     * @description A read-only property to get a parent graph node.
     */
    get parent() {
        return this._parent;
    }

    /**
     * @readonly
     * @name GraphNode#path
     * @type {string}
     * @description A read-only property to get the path of the graph node relative to
     * the root of the hierarchy.
     */
    get path() {
        var parent = this._parent;
        if (parent) {
            var path = this.name;

            while (parent && parent._parent) {
                path = parent.name + "/" + path;
                parent = parent._parent;
            }

            return path;
        }
        return '';
    }

    /**
     * @readonly
     * @name GraphNode#root
     * @type {GraphNode}
     * @description A read-only property to get highest graph node from current node.
     */
    get root() {
        var parent = this._parent;
        if (!parent)
            return this;

        while (parent._parent)
            parent = parent._parent;

        return parent;
    }

    /**
     * @readonly
     * @name GraphNode#children
     * @type {GraphNode[]}
     * @description A read-only property to get the children of this graph node.
     */
    get children() {
        return this._children;
    }

    /**
     * @readonly
     * @name GraphNode#graphDepth
     * @type {number}
     * @description A read-only property to get the depth of this child within the graph. Note that for performance reasons this is only recalculated when a node is added to a new parent, i.e. It is not recalculated when a node is simply removed from the graph.
     */
    get graphDepth() {
        return this._graphDepth;
    }

    _notifyHierarchyStateChanged(node, enabled) {
        node._onHierarchyStateChanged(enabled);

        var c = node._children;
        for (var i = 0, len = c.length; i < len; i++) {
            if (c[i]._enabled)
                this._notifyHierarchyStateChanged(c[i], enabled);
        }
    }

    /**
     * @private
     * @function
     * @name GraphNode#_onHierarchyStateChanged
     * @description Called when the enabled flag of the entity or one of its parents changes.
     * @param {boolean} enabled - True if enabled in the hierarchy, false if disabled.
     */
    _onHierarchyStateChanged(enabled) {
        // Override in derived classes
        this._enabledInHierarchy = enabled;
        if (enabled && !this._frozen)
            this._unfreezeParentToRoot();
    }

    _cloneInternal(clone) {
        clone.name = this.name;

        var tags = this.tags._list;
        clone.tags.clear();
        for (var i = 0; i < tags.length; i++)
            clone.tags.add(tags[i]);

        clone._labels = Object.assign({}, this._labels);

        clone.localPosition.copy(this.localPosition);
        clone.localRotation.copy(this.localRotation);
        clone.localScale.copy(this.localScale);
        clone.localEulerAngles.copy(this.localEulerAngles);

        clone.position.copy(this.position);
        clone.rotation.copy(this.rotation);
        clone.eulerAngles.copy(this.eulerAngles);

        clone.localTransform.copy(this.localTransform);
        clone._dirtyLocal = this._dirtyLocal;

        clone.worldTransform.copy(this.worldTransform);
        clone._dirtyWorld = this._dirtyWorld;
        clone._dirtyNormal = this._dirtyNormal;
        clone._aabbVer = this._aabbVer + 1;

        clone._enabled = this._enabled;

        clone.scaleCompensation = this.scaleCompensation;

        // false as this node is not in the hierarchy yet
        clone._enabledInHierarchy = false;
    }

    clone() {
        var clone = new GraphNode();
        this._cloneInternal(clone);
        return clone;
    }

    // copies properties from source to this
    copy(source) {
        source._cloneInternal(this);
        return this;
    }

    /**
     * @function
     * @name GraphNode#find
     * @description Search the graph node and all of its descendants for the nodes that satisfy some search criteria.
     * @param {callbacks.FindNode|string} attr - This can either be a function or a string. If it's a function, it is executed
     * for each descendant node to test if node satisfies the search logic. Returning true from the function will
     * include the node into the results. If it's a string then it represents the name of a field or a method of the
     * node. If this is the name of a field then the value passed as the second argument will be checked for equality.
     * If this is the name of a function then the return value of the function will be checked for equality against
     * the valued passed as the second argument to this function.
     * @param {object} [value] - If the first argument (attr) is a property name then this value will be checked against
     * the value of the property.
     * @returns {GraphNode[]} The array of graph nodes that match the search criteria.
     * @example
     * // Finds all nodes that have a model component and have `door` in their lower-cased name
     * var doors = house.find(function (node) {
     *     return node.model && node.name.toLowerCase().indexOf('door') !== -1;
     * });
     * @example
     * // Finds all nodes that have the name property set to 'Test'
     * var entities = parent.find('name', 'Test');
     */
    find(attr, value) {
        var result, results = [];
        var len = this._children.length;
        var i, descendants;

        if (attr instanceof Function) {
            var fn = attr;

            result = fn(this);
            if (result)
                results.push(this);

            for (i = 0; i < len; i++) {
                descendants = this._children[i].find(fn);
                if (descendants.length)
                    results = results.concat(descendants);
            }
        } else {
            var testValue;

            if (this[attr]) {
                if (this[attr] instanceof Function) {
                    testValue = this[attr]();
                } else {
                    testValue = this[attr];
                }
                if (testValue === value)
                    results.push(this);
            }

            for (i = 0; i < len; ++i) {
                descendants = this._children[i].find(attr, value);
                if (descendants.length)
                    results = results.concat(descendants);
            }
        }

        return results;
    }

    /**
     * @function
     * @name GraphNode#findOne
     * @description Search the graph node and all of its descendants for the first node that satisfies some search criteria.
     * @param {callbacks.FindNode|string} attr - This can either be a function or a string. If it's a function, it is executed
     * for each descendant node to test if node satisfies the search logic. Returning true from the function will
     * result in that node being returned from findOne. If it's a string then it represents the name of a field or a method of the
     * node. If this is the name of a field then the value passed as the second argument will be checked for equality.
     * If this is the name of a function then the return value of the function will be checked for equality against
     * the valued passed as the second argument to this function.
     * @param {object} [value] - If the first argument (attr) is a property name then this value will be checked against
     * the value of the property.
     * @returns {GraphNode} A graph node that match the search criteria.
     * @example
     * // Find the first node that is called `head` and has a model component
     * var head = player.findOne(function (node) {
     *     return node.model && node.name === 'head';
     * });
     * @example
     * // Finds the first node that has the name property set to 'Test'
     * var node = parent.findOne('name', 'Test');
     */
    findOne(attr, value) {
        var i;
        var len = this._children.length;
        var result = null;

        if (attr instanceof Function) {
            var fn = attr;

            result = fn(this);
            if (result)
                return this;

            for (i = 0; i < len; i++) {
                result = this._children[i].findOne(fn);
                if (result)
                    return result;
            }
        } else {
            var testValue;
            if (this[attr]) {
                if (this[attr] instanceof Function) {
                    testValue = this[attr]();
                } else {
                    testValue = this[attr];
                }
                if (testValue === value) {
                    return this;
                }
            }

            for (i = 0; i < len; i++) {
                result = this._children[i].findOne(attr, value);
                if (result !== null)
                    return result;
            }
        }

        return null;
    }

    /**
     * @function
     * @name GraphNode#findByTag
     * @description Return all graph nodes that satisfy the search query.
     * Query can be simply a string, or comma separated strings,
     * to have inclusive results of assets that match at least one query.
     * A query that consists of an array of tags can be used to match graph nodes that have each tag of array.
     * @param {string|string[]} query - Name of a tag or array of tags.
     * @returns {GraphNode[]} A list of all graph nodes that match the query.
     * @example
     * // Return all graph nodes that tagged by `animal`
     * var animals = node.findByTag("animal");
     * @example
     * // Return all graph nodes that tagged by `bird` OR `mammal`
     * var birdsAndMammals = node.findByTag("bird", "mammal");
     * @example
     * // Return all assets that tagged by `carnivore` AND `mammal`
     * var meatEatingMammals = node.findByTag(["carnivore", "mammal"]);
     * @example
     * // Return all assets that tagged by (`carnivore` AND `mammal`) OR (`carnivore` AND `reptile`)
     * var meatEatingMammalsAndReptiles = node.findByTag(["carnivore", "mammal"], ["carnivore", "reptile"]);
     */
    findByTag() {
        var tags = this.tags._processArguments(arguments);
        return this._findByTag(tags);
    }

    _findByTag(tags) {
        var result = [];
        var i, len = this._children.length;
        var descendants;

        for (i = 0; i < len; i++) {
            if (this._children[i].tags._has(tags))
                result.push(this._children[i]);

            descendants = this._children[i]._findByTag(tags);
            if (descendants.length)
                result = result.concat(descendants);
        }

        return result;
    }

    /**
     * @function
     * @name GraphNode#findByName
     * @description Get the first node found in the graph with the name. The search
     * is depth first.
     * @param {string} name - The name of the graph.
     * @returns {GraphNode} The first node to be found matching the supplied name.
     */
    findByName(name) {
        if (this.name === name) return this;

        for (var i = 0; i < this._children.length; i++) {
            var found = this._children[i].findByName(name);
            if (found !== null) return found;
        }
        return null;
    }

    /**
     * @function
     * @name GraphNode#findByPath
     * @description Get the first node found in the graph by its full path in the graph.
     * The full path has this form 'parent/child/sub-child'. The search is depth first.
     * @param {string|Array} path - The full path of the {@link GraphNode} as either a string or array of {@link GraphNode} names.
     * @returns {GraphNode} The first node to be found matching the supplied path.
     * @example
     * var path = this.entity.findByPath('child/another_child');
     */
    findByPath(path) {
        // if the path isn't an array, split the path in parts. Each part represents a deeper hierarchy level
        var parts;
        if (Array.isArray(path)) {
            if (path.length === 0) return null;
            parts = path;
        } else {
            parts = path.split('/');
        }
        var currentParent = this;
        var result = null;

        for (var i = 0, imax = parts.length; i < imax && currentParent; i++) {
            var part = parts[i];

            result = null;

            // check all the children
            var children = currentParent._children;
            for (var j = 0, jmax = children.length; j < jmax; j++) {
                if (children[j].name === part) {
                    result = children[j];
                    break;
                }
            }

            // keep going deeper in the hierarchy
            currentParent = result;
        }

        return result;
    }

    /**
     * @function
     * @name GraphNode#forEach
     * @description Executes a provided function once on this graph node and all of its descendants.
     * @param {callbacks.ForEach} callback - The function to execute on the graph node and each descendant.
     * @param {object} [thisArg] - Optional value to use as this when executing callback function.
     * @example
     * // Log the path and name of each node in descendant tree starting with "parent"
     * parent.forEach(function (node) {
     *     console.log(node.path + "/" + node.name);
     * });
     */
    forEach(callback, thisArg) {
        callback.call(thisArg, this);

        var children = this._children;
        for (var i = 0; i < children.length; i++) {
            children[i].forEach(callback, thisArg);
        }
    }

    /**
     * @function
     * @name GraphNode#isDescendantOf
     * @description Check if node is descendant of another node.
     * @param {GraphNode} node - Potential ancestor of node.
     * @returns {boolean} If node is descendant of another node.
     * @example
     * if (roof.isDescendantOf(house)) {
     *     // roof is descendant of house entity
     * }
     */
    isDescendantOf(node) {
        var parent = this._parent;
        while (parent) {
            if (parent === node)
                return true;

            parent = parent._parent;
        }
        return false;
    }

    /**
     * @function
     * @name GraphNode#isAncestorOf
     * @description Check if node is ancestor for another node.
     * @param {GraphNode} node - Potential descendant of node.
     * @returns {boolean} If node is ancestor for another node.
     * @example
     * if (body.isAncestorOf(foot)) {
     *     // foot is within body's hierarchy
     * }
     */
    isAncestorOf(node) {
        return node.isDescendantOf(this);
    }

    /**
     * @function
     * @name GraphNode#getEulerAngles
     * @description Get the world space rotation for the specified GraphNode in Euler angle
     * form. The rotation is returned as euler angles in a {@link Vec3}. The value returned by this function
     * should be considered read-only. In order to set the world-space rotation of the graph
     * node, use {@link GraphNode#setEulerAngles}.
     * @returns {Vec3} The world space rotation of the graph node in Euler angle form.
     * @example
     * var angles = this.entity.getEulerAngles();
     * angles.y = 180; // rotate the entity around Y by 180 degrees
     * this.entity.setEulerAngles(angles);
     */
    getEulerAngles() {
        this.getWorldTransform().getEulerAngles(this.eulerAngles);
        return this.eulerAngles;
    }

    /**
     * @function
     * @name GraphNode#getLocalEulerAngles
     * @description Get the rotation in local space for the specified GraphNode. The rotation
     * is returned as euler angles in a {@link Vec3}. The
     * returned vector should be considered read-only. To update the local rotation, use
     * {@link GraphNode#setLocalEulerAngles}.
     * @returns {Vec3} The local space rotation of the graph node as euler angles in XYZ order.
     * @example
     * var angles = this.entity.getLocalEulerAngles();
     * angles.y = 180;
     * this.entity.setLocalEulerAngles(angles);
     */
    getLocalEulerAngles() {
        this.localRotation.getEulerAngles(this.localEulerAngles);
        return this.localEulerAngles;
    }

    /**
     * @function
     * @name GraphNode#getLocalPosition
     * @description Get the position in local space for the specified GraphNode. The position
     * is returned as a {@link Vec3}. The returned vector should be considered read-only.
     * To update the local position, use {@link GraphNode#setLocalPosition}.
     * @returns {Vec3} The local space position of the graph node.
     * @example
     * var position = this.entity.getLocalPosition();
     * position.x += 1; // move the entity 1 unit along x.
     * this.entity.setLocalPosition(position);
     */
    getLocalPosition() {
        return this.localPosition;
    }

    /**
     * @function
     * @name GraphNode#getLocalRotation
     * @description Get the rotation in local space for the specified GraphNode. The rotation
     * is returned as a {@link Quat}. The returned quaternion should be considered read-only.
     * To update the local rotation, use {@link GraphNode#setLocalRotation}.
     * @returns {Quat} The local space rotation of the graph node as a quaternion.
     * @example
     * var rotation = this.entity.getLocalRotation();
     */
    getLocalRotation() {
        return this.localRotation;
    }

    /**
     * @function
     * @name GraphNode#getLocalScale
     * @description Get the scale in local space for the specified GraphNode. The scale
     * is returned as a {@link Vec3}. The returned vector should be considered read-only.
     * To update the local scale, use {@link GraphNode#setLocalScale}.
     * @returns {Vec3} The local space scale of the graph node.
     * @example
     * var scale = this.entity.getLocalScale();
     * scale.x = 100;
     * this.entity.setLocalScale(scale);
     */
    getLocalScale() {
        return this.localScale;
    }

    /**
     * @function
     * @name GraphNode#getLocalTransform
     * @description Get the local transform matrix for this graph node. This matrix
     * is the transform relative to the node's parent's world transformation matrix.
     * @returns {Mat4} The node's local transformation matrix.
     * @example
     * var transform = this.entity.getLocalTransform();
     */
    getLocalTransform() {
        if (this._dirtyLocal) {
            this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);
            this._dirtyLocal = false;
        }
        return this.localTransform;
    }

    /**
     * @function
     * @name GraphNode#getPosition
     * @description Get the world space position for the specified GraphNode. The position
     * is returned as a {@link Vec3}. The value returned by this function should be considered read-only.
     * In order to set the world-space position of the graph node, use {@link GraphNode#setPosition}.
     * @returns {Vec3} The world space position of the graph node.
     * @example
     * var position = this.entity.getPosition();
     * position.x = 10;
     * this.entity.setPosition(position);
     */
    getPosition() {
        this.getWorldTransform().getTranslation(this.position);
        return this.position;
    }

    /**
     * @function
     * @name GraphNode#getRotation
     * @description Get the world space rotation for the specified GraphNode. The rotation
     * is returned as a {@link Quat}. The value returned by this function should be considered read-only. In order
     * to set the world-space rotation of the graph node, use {@link GraphNode#setRotation}.
     * @returns {Quat} The world space rotation of the graph node as a quaternion.
     * @example
     * var rotation = this.entity.getRotation();
     */
    getRotation() {
        this.rotation.setFromMat4(this.getWorldTransform());
        return this.rotation;
    }

    /**
     * @private
     * @function
     * @name GraphNode#getScale
     * @description Get the world space scale for the specified GraphNode. The returned value
     * will only be correct for graph nodes that have a non-skewed world transform (a skew can
     * be introduced by the compounding of rotations and scales higher in the graph node
     * hierarchy). The scale is returned as a {@link Vec3}.
     * The value returned by this function should be considered read-only. Note
     * that it is not possible to set the world space scale of a graph node directly.
     * @returns {Vec3} The world space scale of the graph node.
     * @example
     * var scale = this.entity.getScale();
     */
    getScale() {
        if (!this._scale) {
            this._scale = new Vec3();
        }
        return this.getWorldTransform().getScale(this._scale);
    }

    /**
     * @function
     * @name GraphNode#getWorldTransform
     * @description Get the world transformation matrix for this graph node.
     * @returns {Mat4} The node's world transformation matrix.
     * @example
     * var transform = this.entity.getWorldTransform();
     */
    getWorldTransform() {
        if (!this._dirtyLocal && !this._dirtyWorld)
            return this.worldTransform;

        if (this._parent)
            this._parent.getWorldTransform();

        this._sync();

        return this.worldTransform;
    }

    /**
     * @function
     * @name GraphNode#reparent
     * @description Remove graph node from current parent and add as child to new parent.
     * @param {GraphNode} parent - New parent to attach graph node to.
     * @param {number} [index] - The child index where the child node should be placed.
     */
    reparent(parent, index) {
        var current = this._parent;

        if (current)
            current.removeChild(this);

        if (parent) {
            if (index >= 0) {
                parent.insertChild(this, index);
            } else {
                parent.addChild(this);
            }
        }
    }

    /**
     * @function
     * @name GraphNode#setLocalEulerAngles
     * @description Sets the local-space rotation of the specified graph node using euler angles.
     * Eulers are interpreted in XYZ order. Eulers must be specified in degrees. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * local-space euler rotation.
     * @param {Vec3|number} x - 3-dimensional vector holding eulers or rotation around local-space
     * x-axis in degrees.
     * @param {number} [y] - Rotation around local-space y-axis in degrees.
     * @param {number} [z] - Rotation around local-space z-axis in degrees.
     * @example
     * // Set rotation of 90 degrees around y-axis via 3 numbers
     * this.entity.setLocalEulerAngles(0, 90, 0);
     * @example
     * // Set rotation of 90 degrees around y-axis via a vector
     * var angles = new pc.Vec3(0, 90, 0);
     * this.entity.setLocalEulerAngles(angles);
     */
    setLocalEulerAngles(x, y, z) {
        if (x instanceof Vec3) {
            this.localRotation.setFromEulerAngles(x.x, x.y, x.z);
        } else {
            this.localRotation.setFromEulerAngles(x, y, z);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * @function
     * @name GraphNode#setLocalPosition
     * @description Sets the local-space position of the specified graph node. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * local-space position.
     * @param {Vec3|number} x - 3-dimensional vector holding local-space position or
     * x-coordinate of local-space position.
     * @param {number} [y] - Y-coordinate of local-space position.
     * @param {number} [z] - Z-coordinate of local-space position.
     * @example
     * // Set via 3 numbers
     * this.entity.setLocalPosition(0, 10, 0);
     * @example
     * // Set via vector
     * var pos = new pc.Vec3(0, 10, 0);
     * this.entity.setLocalPosition(pos);
     */
    setLocalPosition(x, y, z) {
        if (x instanceof Vec3) {
            this.localPosition.copy(x);
        } else {
            this.localPosition.set(x, y, z);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * @function
     * @name GraphNode#setLocalRotation
     * @description Sets the local-space rotation of the specified graph node. This function
     * has two valid signatures: you can either pass a quaternion or 3 numbers to specify the
     * local-space rotation.
     * @param {Quat|number} x - Quaternion holding local-space rotation or x-component of
     * local-space quaternion rotation.
     * @param {number} [y] - Y-component of local-space quaternion rotation.
     * @param {number} [z] - Z-component of local-space quaternion rotation.
     * @param {number} [w] - W-component of local-space quaternion rotation.
     * @example
     * // Set via 4 numbers
     * this.entity.setLocalRotation(0, 0, 0, 1);
     * @example
     * // Set via quaternion
     * var q = pc.Quat();
     * this.entity.setLocalRotation(q);
     */
    setLocalRotation(x, y, z, w) {
        if (x instanceof Quat) {
            this.localRotation.copy(x);
        } else {
            this.localRotation.set(x, y, z, w);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * @function
     * @name GraphNode#setLocalScale
     * @description Sets the local-space scale factor of the specified graph node. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * local-space scale.
     * @param {Vec3|number} x - 3-dimensional vector holding local-space scale or x-coordinate
     * of local-space scale.
     * @param {number} [y] - Y-coordinate of local-space scale.
     * @param {number} [z] - Z-coordinate of local-space scale.
     * @example
     * // Set via 3 numbers
     * this.entity.setLocalScale(10, 10, 10);
     * @example
     * // Set via vector
     * var scale = new pc.Vec3(10, 10, 10);
     * this.entity.setLocalScale(scale);
     */
    setLocalScale(x, y, z) {
        if (x instanceof Vec3) {
            this.localScale.copy(x);
        } else {
            this.localScale.set(x, y, z);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    _dirtifyLocal() {
        if (!this._dirtyLocal) {
            this._dirtyLocal = true;
            if (!this._dirtyWorld)
                this._dirtifyWorld();
        }
    }

    _unfreezeParentToRoot() {
        var p = this._parent;
        while (p) {
            p._frozen = false;
            p = p._parent;
        }
    }

    _dirtifyWorld() {
        if (!this._dirtyWorld)
            this._unfreezeParentToRoot();
        this._dirtifyWorldInternal();
    }

    _dirtifyWorldInternal() {
        if (!this._dirtyWorld) {
            this._frozen = false;
            this._dirtyWorld = true;
            for (var i = 0; i < this._children.length; i++) {
                if (!this._children[i]._dirtyWorld)
                    this._children[i]._dirtifyWorldInternal();
            }
        }
        this._dirtyNormal = true;
        this._aabbVer++;
    }

    /**
     * @function
     * @name GraphNode#setPosition
     * @description Sets the world-space position of the specified graph node. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * world-space position.
     * @param {Vec3|number} x - 3-dimensional vector holding world-space position or
     * x-coordinate of world-space position.
     * @param {number} [y] - Y-coordinate of world-space position.
     * @param {number} [z] - Z-coordinate of world-space position.
     * @example
     * // Set via 3 numbers
     * this.entity.setPosition(0, 10, 0);
     * @example
     * // Set via vector
     * var position = new pc.Vec3(0, 10, 0);
     * this.entity.setPosition(position);
     */
    setPosition(x, y, z) {
        if (x instanceof Vec3) {
            position.copy(x);
        } else {
            position.set(x, y, z);
        }

        if (this._parent === null) {
            this.localPosition.copy(position);
        } else {
            invParentWtm.copy(this._parent.getWorldTransform()).invert();
            invParentWtm.transformPoint(position, this.localPosition);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * @function
     * @name GraphNode#setRotation
     * @description Sets the world-space rotation of the specified graph node. This function
     * has two valid signatures: you can either pass a quaternion or 3 numbers to specify the
     * world-space rotation.
     * @param {Quat|number} x - Quaternion holding world-space rotation or x-component of
     * world-space quaternion rotation.
     * @param {number} [y] - Y-component of world-space quaternion rotation.
     * @param {number} [z] - Z-component of world-space quaternion rotation.
     * @param {number} [w] - W-component of world-space quaternion rotation.
     * @example
     * // Set via 4 numbers
     * this.entity.setRotation(0, 0, 0, 1);
     * @example
     * // Set via quaternion
     * var q = pc.Quat();
     * this.entity.setRotation(q);
     */
    setRotation(x, y, z, w) {
        if (x instanceof Quat) {
            rotation.copy(x);
        } else {
            rotation.set(x, y, z, w);
        }

        if (this._parent === null) {
            this.localRotation.copy(rotation);
        } else {
            var parentRot = this._parent.getRotation();
            invParentRot.copy(parentRot).invert();
            this.localRotation.copy(invParentRot).mul(rotation);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * @function
     * @name GraphNode#setEulerAngles
     * @description Sets the world-space rotation of the specified graph node using euler angles.
     * Eulers are interpreted in XYZ order. Eulers must be specified in degrees. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * world-space euler rotation.
     * @param {Vec3|number} x - 3-dimensional vector holding eulers or rotation around world-space
     * x-axis in degrees.
     * @param {number} [y] - Rotation around world-space y-axis in degrees.
     * @param {number} [z] - Rotation around world-space z-axis in degrees.
     * @example
     * // Set rotation of 90 degrees around world-space y-axis via 3 numbers
     * this.entity.setEulerAngles(0, 90, 0);
     * @example
     * // Set rotation of 90 degrees around world-space y-axis via a vector
     * var angles = new pc.Vec3(0, 90, 0);
     * this.entity.setEulerAngles(angles);
     */
    setEulerAngles(x, y, z) {
        if (x instanceof Vec3) {
            this.localRotation.setFromEulerAngles(x.x, x.y, x.z);
        } else {
            this.localRotation.setFromEulerAngles(x, y, z);
        }

        if (this._parent !== null) {
            var parentRot = this._parent.getRotation();
            invParentRot.copy(parentRot).invert();
            this.localRotation.mul2(invParentRot, this.localRotation);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * @function
     * @name GraphNode#addChild
     * @description Add a new child to the child list and update the parent value of the child node.
     * @param {GraphNode} node - The new child to add.
     * @example
     * var e = new pc.Entity(app);
     * this.entity.addChild(e);
     */
    addChild(node) {
        if (node._parent !== null)
            throw new Error("GraphNode is already parented");

        // #if _DEBUG
        this._debugInsertChild(node);
        // #endif

        this._children.push(node);
        this._onInsertChild(node);
    }

    addChildAndSaveTransform(node) {
        // #if _DEBUG
        this._debugInsertChild(node);
        // #endif

        var wPos = node.getPosition();
        var wRot = node.getRotation();

        var current = node._parent;
        if (current)
            current.removeChild(node);

        node.setPosition(tmpMat4.copy(this.worldTransform).invert().transformPoint(wPos));
        node.setRotation(tmpQuat.copy(this.getRotation()).invert().mul(wRot));

        this._children.push(node);
        this._onInsertChild(node);
    }

    /**
     * @function
     * @name GraphNode#insertChild
     * @description Insert a new child to the child list at the specified index and update the parent value of the child node.
     * @param {GraphNode} node - The new child to insert.
     * @param {number} index - The index in the child list of the parent where the new node will be inserted.
     * @example
     * var e = new pc.Entity(app);
     * this.entity.insertChild(e, 1);
     */
    insertChild(node, index) {
        if (node._parent !== null)
            throw new Error("GraphNode is already parented");

        // #if _DEBUG
        this._debugInsertChild(node);
        // #endif

        this._children.splice(index, 0, node);
        this._onInsertChild(node);
    }

    // #if _DEBUG
    _debugInsertChild(node) {
        if (this === node)
            throw new Error("GraphNode cannot be a child of itself");

        if (this.isDescendantOf(node))
            throw new Error("GraphNode cannot add an ancestor as a child");
    }
    // #endif

    _onInsertChild(node) {
        node._parent = this;

        // the child node should be enabled in the hierarchy only if itself is enabled and if
        // this parent is enabled
        var enabledInHierarchy = (node._enabled && this.enabled);
        if (node._enabledInHierarchy !== enabledInHierarchy) {
            node._enabledInHierarchy = enabledInHierarchy;

            // propagate the change to the children - necessary if we reparent a node
            // under a parent with a different enabled state (if we reparent a node that is
            // not active in the hierarchy under a parent who is active in the hierarchy then
            // we want our node to be activated)
            node._notifyHierarchyStateChanged(node, enabledInHierarchy);
        }

        // The graph depth of the child and all of its descendants will now change
        node._updateGraphDepth();

        // The child (plus subhierarchy) will need world transforms to be recalculated
        node._dirtifyWorld();
        // node might be already marked as dirty, in that case the whole chain stays frozen, so let's enforce unfreeze
        if (this._frozen)
            node._unfreezeParentToRoot();

        // alert an entity that it has been inserted
        if (node.fire) node.fire('insert', this);

        // alert the parent that it has had a child inserted
        if (this.fire) this.fire('childinsert', node);
    }

    _updateGraphDepth() {
        if (this._parent) {
            this._graphDepth = this._parent._graphDepth + 1;
        } else {
            this._graphDepth = 0;
        }

        for (var i = 0, len = this._children.length; i < len; i++) {
            this._children[i]._updateGraphDepth();
        }
    }

    /**
     * @function
     * @name GraphNode#removeChild
     * @description Remove the node from the child list and update the parent value of the child.
     * @param {GraphNode} child - The node to remove.
     * @example
     * var child = this.entity.children[0];
     * this.entity.removeChild(child);
     */
    removeChild(child) {
        var i;
        var length = this._children.length;

        // Remove from child list
        for (i = 0; i < length; ++i) {
            if (this._children[i] === child) {
                this._children.splice(i, 1);

                // Clear parent
                child._parent = null;

                // alert child that it has been removed
                if (child.fire) child.fire('remove', this);

                // alert the parent that it has had a child removed
                if (this.fire) this.fire('childremove', child);

                return;
            }
        }
    }

    _sync() {
        if (this._dirtyLocal) {
            this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

            this._dirtyLocal = false;
        }

        if (this._dirtyWorld) {
            if (this._parent === null) {
                this.worldTransform.copy(this.localTransform);
            } else {
                if (this.scaleCompensation) {
                    var parentWorldScale;
                    var parent = this._parent;

                    // Find a parent of the first uncompensated node up in the hierarchy and use its scale * localScale
                    var scale = this.localScale;
                    var parentToUseScaleFrom = parent; // current parent
                    if (parentToUseScaleFrom) {
                        while (parentToUseScaleFrom && parentToUseScaleFrom.scaleCompensation) {
                            parentToUseScaleFrom = parentToUseScaleFrom._parent;
                        }
                        // topmost node with scale compensation
                        if (parentToUseScaleFrom) {
                            parentToUseScaleFrom = parentToUseScaleFrom._parent; // node without scale compensation
                            if (parentToUseScaleFrom) {
                                parentWorldScale = parentToUseScaleFrom.worldTransform.getScale();
                                scaleCompensateScale.mul2(parentWorldScale, this.localScale);
                                scale = scaleCompensateScale;
                            }
                        }
                    }

                    // Rotation is as usual
                    scaleCompensateRot2.setFromMat4(parent.worldTransform);
                    scaleCompensateRot.mul2(scaleCompensateRot2, this.localRotation);

                    // Find matrix to transform position
                    var tmatrix = parent.worldTransform;
                    if (parent.scaleCompensation) {
                        scaleCompensateScaleForParent.mul2(parentWorldScale, parent.getLocalScale());
                        scaleCompensatePosTransform.setTRS(parent.worldTransform.getTranslation(scaleCompensatePos),
                                                           scaleCompensateRot2,
                                                           scaleCompensateScaleForParent);
                        tmatrix = scaleCompensatePosTransform;
                    }
                    tmatrix.transformPoint(this.localPosition, scaleCompensatePos);

                    this.worldTransform.setTRS(scaleCompensatePos, scaleCompensateRot, scale);

                } else {
                    this.worldTransform.mulAffine2(this._parent.worldTransform, this.localTransform);
                }
            }

            this._dirtyWorld = false;
        }
    }

    /**
     * @private
     * @function
     * @name GraphNode#syncHierarchy
     * @description Updates the world transformation matrices at this node and all of its descendants.
     */
    syncHierarchy() {
        if (!this._enabled)
            return;

        if (this._frozen)
            return;
        this._frozen = true;

        if (this._dirtyLocal || this._dirtyWorld) {
            this._sync();
        }

        var children = this._children;
        for (var i = 0, len = children.length; i < len; i++) {
            children[i].syncHierarchy();
        }
    }

    /**
     * @function
     * @name GraphNode#lookAt
     * @description Reorients the graph node so that the negative z-axis points towards the target.
     * This function has two valid signatures. Either pass 3D vectors for the look at coordinate and up
     * vector, or pass numbers to represent the vectors.
     * @param {Vec3|number} x - If passing a 3D vector, this is the world-space coordinate to look at.
     * Otherwise, it is the x-component of the world-space coordinate to look at.
     * @param {Vec3|number} [y] - If passing a 3D vector, this is the world-space up vector for look at
     * transform. Otherwise, it is the y-component of the world-space coordinate to look at.
     * @param {number} [z] - Z-component of the world-space coordinate to look at.
     * @param {number} [ux=0] - X-component of the up vector for the look at transform.
     * @param {number} [uy=1] - Y-component of the up vector for the look at transform.
     * @param {number} [uz=0] - Z-component of the up vector for the look at transform.
     * @example
     * // Look at another entity, using the (default) positive y-axis for up
     * var position = otherEntity.getPosition();
     * this.entity.lookAt(position);
     * @example
     * // Look at another entity, using the negative world y-axis for up
     * var position = otherEntity.getPosition();
     * this.entity.lookAt(position, pc.Vec3.DOWN);
     * @example
     * // Look at the world space origin, using the (default) positive y-axis for up
     * this.entity.lookAt(0, 0, 0);
     * @example
     * // Look at world-space coordinate [10, 10, 10], using the negative world y-axis for up
     * this.entity.lookAt(10, 10, 10, 0, -1, 0);
     */
    lookAt(x, y, z, ux = 0, uy = 1, uz = 0) {
        if (x instanceof Vec3) {
            target.copy(x);

            if (y instanceof Vec3) { // vec3, vec3
                up.copy(y);
            } else { // vec3
                up.copy(Vec3.UP);
            }
        } else if (z === undefined) {
            return;
        } else {
            target.set(x, y, z);
            up.set(ux, uy, uz);
        }

        matrix.setLookAt(this.getPosition(), target, up);
        rotation.setFromMat4(matrix);
        this.setRotation(rotation);
    }

    /**
     * @function
     * @name GraphNode#translate
     * @description Translates the graph node in world-space by the specified translation vector.
     * This function has two valid signatures: you can either pass a 3D vector or 3 numbers to
     * specify the world-space translation.
     * @param {Vec3|number} x - 3-dimensional vector holding world-space translation or
     * x-coordinate of world-space translation.
     * @param {number} [y] - Y-coordinate of world-space translation.
     * @param {number} [z] - Z-coordinate of world-space translation.
     * @example
     * // Translate via 3 numbers
     * this.entity.translate(10, 0, 0);
     * @example
     * // Translate via vector
     * var t = new pc.Vec3(10, 0, 0);
     * this.entity.translate(t);
     */
    translate(x, y, z) {
        if (x instanceof Vec3) {
            position.copy(x);
        } else {
            position.set(x, y, z);
        }

        position.add(this.getPosition());
        this.setPosition(position);
    }

    /**
     * @function
     * @name GraphNode#translateLocal
     * @description Translates the graph node in local-space by the specified translation vector.
     * This function has two valid signatures: you can either pass a 3D vector or 3 numbers to
     * specify the local-space translation.
     * @param {Vec3|number} x - 3-dimensional vector holding local-space translation or
     * x-coordinate of local-space translation.
     * @param {number} [y] - Y-coordinate of local-space translation.
     * @param {number} [z] - Z-coordinate of local-space translation.
     * @example
     * // Translate via 3 numbers
     * this.entity.translateLocal(10, 0, 0);
     * @example
     * // Translate via vector
     * var t = new pc.Vec3(10, 0, 0);
     * this.entity.translateLocal(t);
     */
    translateLocal(x, y, z) {
        if (x instanceof Vec3) {
            position.copy(x);
        } else {
            position.set(x, y, z);
        }

        this.localRotation.transformVector(position, position);
        this.localPosition.add(position);

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * @function
     * @name GraphNode#rotate
     * @description Rotates the graph node in world-space by the specified Euler angles.
     * Eulers are specified in degrees in XYZ order. This function has two valid signatures:
     * you can either pass a 3D vector or 3 numbers to specify the world-space rotation.
     * @param {Vec3|number} x - 3-dimensional vector holding world-space rotation or
     * rotation around world-space x-axis in degrees.
     * @param {number} [y] - Rotation around world-space y-axis in degrees.
     * @param {number} [z] - Rotation around world-space z-axis in degrees.
     * @example
     * // Rotate via 3 numbers
     * this.entity.rotate(0, 90, 0);
     * @example
     * // Rotate via vector
     * var r = new pc.Vec3(0, 90, 0);
     * this.entity.rotate(r);
     */
    rotate(x, y, z) {
        if (x instanceof Vec3) {
            rotation.setFromEulerAngles(x.x, x.y, x.z);
        } else {
            rotation.setFromEulerAngles(x, y, z);
        }

        if (this._parent === null) {
            this.localRotation.mul2(rotation, this.localRotation);
        } else {
            var rot = this.getRotation();
            var parentRot = this._parent.getRotation();

            invParentRot.copy(parentRot).invert();
            rotation.mul2(invParentRot, rotation);
            this.localRotation.mul2(rotation, rot);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * @function
     * @name GraphNode#rotateLocal
     * @description Rotates the graph node in local-space by the specified Euler angles.
     * Eulers are specified in degrees in XYZ order. This function has two valid signatures:
     * you can either pass a 3D vector or 3 numbers to specify the local-space rotation.
     * @param {Vec3|number} x - 3-dimensional vector holding local-space rotation or
     * rotation around local-space x-axis in degrees.
     * @param {number} [y] - Rotation around local-space y-axis in degrees.
     * @param {number} [z] - Rotation around local-space z-axis in degrees.
     * @example
     * // Rotate via 3 numbers
     * this.entity.rotateLocal(0, 90, 0);
     * @example
     * // Rotate via vector
     * var r = new pc.Vec3(0, 90, 0);
     * this.entity.rotateLocal(r);
     */
    rotateLocal(x, y, z) {
        if (x instanceof Vec3) {
            rotation.setFromEulerAngles(x.x, x.y, x.z);
        } else {
            rotation.setFromEulerAngles(x, y, z);
        }

        this.localRotation.mul(rotation);

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }
}

export { GraphNode };
