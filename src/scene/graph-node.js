import { EventHandler } from '../core/event-handler.js';
import { Tags } from '../core/tags.js';
import { Debug } from '../core/debug.js';

import { Mat3 } from '../core/math/mat3.js';
import { Mat4 } from '../core/math/mat4.js';
import { Quat } from '../core/math/quat.js';
import { Vec3 } from '../core/math/vec3.js';

const scaleCompensatePosTransform = new Mat4();
const scaleCompensatePos = new Vec3();
const scaleCompensateRot = new Quat();
const scaleCompensateRot2 = new Quat();
const scaleCompensateScale = new Vec3();
const scaleCompensateScaleForParent = new Vec3();
const tmpMat4 = new Mat4();
const tmpQuat = new Quat();
const position = new Vec3();
const invParentWtm = new Mat4();
const rotation = new Quat();
const invParentRot = new Quat();
const matrix = new Mat4();
const target = new Vec3();
const up = new Vec3();

/**
 * Helper function that handles signature overloading to receive a test function.
 *
 * @param {FindNodeCallback|string} attr - Attribute or lambda.
 * @param {*} [value] - Optional value in case of `attr` being a `string`
 * @returns {FindNodeCallback} Test function that receives a GraphNode and returns a boolean.
 * @ignore
 */
function createTest(attr, value) {
    if (attr instanceof Function) {
        return attr;
    }
    return (node) => {
        let x = node[attr];
        if (x instanceof Function) {
            x = x();
        }
        return x === value;
    };
}

/**
 * Helper function to recurse findOne without calling createTest constantly.
 *
 * @param {GraphNode} node - Current node.
 * @param {FindNodeCallback} test - Test function.
 * @returns {GraphNode|null} A graph node that matches the search criteria. Returns null if no
 * node is found.
 * @ignore
 */
function findNode(node, test) {
    if (test(node))
        return node;

    const children = node._children;
    const len = children.length;
    for (let i = 0; i < len; ++i) {
        const result = findNode(children[i], test);
        if (result)
            return result;
    }

    return null;
}

/**
 * Callback used by {@link GraphNode#find} and {@link GraphNode#findOne} to search through a graph
 * node and all of its descendants.
 *
 * @callback FindNodeCallback
 * @param {GraphNode} node - The current graph node.
 * @returns {boolean} Returning `true` will result in that node being returned from
 * {@link GraphNode#find} or {@link GraphNode#findOne}.
 */

/**
 * Callback used by {@link GraphNode#forEach} to iterate through a graph node and all of its
 * descendants.
 *
 * @callback ForEachNodeCallback
 * @param {GraphNode} node - The current graph node.
 */

/**
 * The `GraphNode` class represents a node within a hierarchical scene graph. Each `GraphNode` can
 * reference a array of child nodes. This creates a tree-like structure that is fundamental for
 * organizing and managing the spatial relationships between objects in a 3D scene. This class
 * provides a comprehensive API for manipulating the position, rotation, and scale of nodes both
 * locally and in world space.
 *
 * `GraphNode` is the superclass of {@link Entity}, which is the primary class for creating objects
 * in a PlayCanvas application. For this reason, `GraphNode` is rarely used directly, but it provides
 * a powerful set of features that are leveraged by the `Entity` class.
 */
class GraphNode extends EventHandler {
    /**
     * The non-unique name of a graph node. Defaults to 'Untitled'.
     *
     * @type {string}
     */
    name;

    /**
     * Interface for tagging graph nodes. Tag based searches can be performed using the
     * {@link GraphNode#findByTag} function.
     *
     * @type {Tags}
     */
    tags = new Tags(this);

    // Local space properties of transform (only first 3 are settable by the user)
    /**
     * @type {Vec3}
     * @private
     */
    localPosition = new Vec3();

    /**
     * @type {Quat}
     * @private
     */
    localRotation = new Quat();

    /**
     * @type {Vec3}
     * @private
     */
    localScale = new Vec3(1, 1, 1);

    /**
     * @type {Vec3}
     * @private
     */
    localEulerAngles = new Vec3(); // Only calculated on request

    // World space properties of transform
    /**
     * @type {Vec3}
     * @private
     */
    position = new Vec3();

    /**
     * @type {Quat}
     * @private
     */
    rotation = new Quat();

    /**
     * @type {Vec3}
     * @private
     */
    eulerAngles = new Vec3();

    /**
     * @type {Vec3|null}
     * @private
     */
    _scale = null;

    /**
     * @type {Mat4}
     * @private
     */
    localTransform = new Mat4();

    /**
     * @type {boolean}
     * @private
     */
    _dirtyLocal = false;

    /**
     * @type {number}
     * @private
     */
    _aabbVer = 0;

    /**
     * Marks the node to ignore hierarchy sync entirely (including children nodes). The engine code
     * automatically freezes and unfreezes objects whenever required. Segregating dynamic and
     * stationary nodes into subhierarchies allows to reduce sync time significantly.
     *
     * @type {boolean}
     * @private
     */
    _frozen = false;

    /**
     * @type {Mat4}
     * @private
     */
    worldTransform = new Mat4();

    /**
     * @type {boolean}
     * @private
     */
    _dirtyWorld = false;

    /**
     * Cached value representing the negatively scaled world transform. If the value is 0, this
     * marks this value as dirty and it needs to be recalculated. If the value is 1, the world
     * transform is not negatively scaled. If the value is -1, the world transform is negatively
     * scaled.
     *
     * @type {number}
     * @private
     */
    _worldScaleSign = 0;

    /**
     * @type {Mat3}
     * @private
     */
    _normalMatrix = new Mat3();

    /**
     * @type {boolean}
     * @private
     */
    _dirtyNormal = true;

    /**
     * @type {Vec3|null}
     * @private
     */
    _right = null;

    /**
     * @type {Vec3|null}
     * @private
     */
    _up = null;

    /**
     * @type {Vec3|null}
     * @private
     */
    _forward = null;

    /**
     * @type {GraphNode|null}
     * @private
     */
    _parent = null;

    /**
     * @type {GraphNode[]}
     * @protected
     */
    _children = [];

    /**
     * @type {number}
     * @private
     */
    _graphDepth = 0;

    /**
     * Represents enabled state of the entity. If the entity is disabled, the entity including all
     * children are excluded from updates.
     *
     * @type {boolean}
     * @private
     */
    _enabled = true;

    /**
     * Represents enabled state of the entity in the hierarchy. It's true only if this entity and
     * all parent entities all the way to the scene's root are enabled.
     *
     * @type {boolean}
     * @private
     */
    _enabledInHierarchy = false;

    /**
     * @type {boolean}
     * @ignore
     */
    scaleCompensation = false;

    /**
     * Create a new GraphNode instance.
     *
     * @param {string} [name] - The non-unique name of a graph node. Defaults to 'Untitled'.
     */
    constructor(name = 'Untitled') {
        super();

        this.name = name;
    }

    /**
     * Gets the normalized local space X-axis vector of the graph node in world space.
     *
     * @type {Vec3}
     */
    get right() {
        if (!this._right) {
            this._right = new Vec3();
        }
        return this.getWorldTransform().getX(this._right).normalize();
    }

    /**
     * Gets the normalized local space Y-axis vector of the graph node in world space.
     *
     * @type {Vec3}
     */
    get up() {
        if (!this._up) {
            this._up = new Vec3();
        }
        return this.getWorldTransform().getY(this._up).normalize();
    }

    /**
     * Gets the normalized local space negative Z-axis vector of the graph node in world space.
     *
     * @type {Vec3}
     */
    get forward() {
        if (!this._forward) {
            this._forward = new Vec3();
        }
        return this.getWorldTransform().getZ(this._forward).normalize().mulScalar(-1);
    }

    /**
     * Gets the 3x3 transformation matrix used to transform normals.
     *
     * @type {Mat3}
     * @ignore
     */
    get normalMatrix() {

        const normalMat = this._normalMatrix;
        if (this._dirtyNormal) {
            normalMat.invertMat4(this.getWorldTransform()).transpose();
            this._dirtyNormal = false;
        }

        return normalMat;
    }

    /**
     * Sets the enabled state of the GraphNode. If one of the GraphNode's parents is disabled there
     * will be no other side effects. If all the parents are enabled then the new value will
     * activate or deactivate all the enabled children of the GraphNode.
     *
     * @type {boolean}
     */
    set enabled(enabled) {
        if (this._enabled !== enabled) {
            this._enabled = enabled;

            // if enabling entity, make all children enabled in hierarchy only when the parent is as well
            // if disabling entity, make all children disabled in hierarchy in all cases
            if (enabled && this._parent?.enabled || !enabled) {
                this._notifyHierarchyStateChanged(this, enabled);
            }
        }
    }

    /**
     * Gets the enabled state of the GraphNode.
     *
     * @type {boolean}
     */
    get enabled() {
        // make sure to check this._enabled too because if that
        // was false when a parent was updated the _enabledInHierarchy
        // flag may not have been updated for optimization purposes
        return this._enabled && this._enabledInHierarchy;
    }

    /**
     * Gets the parent of this graph node.
     *
     * @type {GraphNode|null}
     */
    get parent() {
        return this._parent;
    }

    /**
     * Gets the path of this graph node relative to the root of the hierarchy.
     *
     * @type {string}
     */
    get path() {
        let node = this._parent;
        if (!node) {
            return '';
        }

        let result = this.name;
        while (node && node._parent) {
            result = `${node.name}/${result}`;
            node = node._parent;
        }
        return result;
    }

    /**
     * Gets the oldest ancestor graph node from this graph node.
     *
     * @type {GraphNode}
     */
    get root() {
        let result = this;
        while (result._parent) {
            result = result._parent;
        }
        return result;
    }

    /**
     * Gets the children of this graph node.
     *
     * @type {GraphNode[]}
     */
    get children() {
        return this._children;
    }

    /**
     * Gets the depth of this child within the graph. Note that for performance reasons this is
     * only recalculated when a node is added to a new parent. In other words, it is not
     * recalculated when a node is simply removed from the graph.
     *
     * @type {number}
     */
    get graphDepth() {
        return this._graphDepth;
    }

    /**
     * @param {GraphNode} node - Graph node to update.
     * @param {boolean} enabled - True if enabled in the hierarchy, false if disabled.
     * @private
     */
    _notifyHierarchyStateChanged(node, enabled) {
        node._onHierarchyStateChanged(enabled);

        const c = node._children;
        for (let i = 0, len = c.length; i < len; i++) {
            if (c[i]._enabled)
                this._notifyHierarchyStateChanged(c[i], enabled);
        }
    }

    /**
     * Called when the enabled flag of the entity or one of its parents changes.
     *
     * @param {boolean} enabled - True if enabled in the hierarchy, false if disabled.
     * @private
     */
    _onHierarchyStateChanged(enabled) {
        // Override in derived classes
        this._enabledInHierarchy = enabled;
        if (enabled && !this._frozen)
            this._unfreezeParentToRoot();
    }

    /**
     * @param {this} clone - The cloned graph node to copy into.
     * @private
     */
    _cloneInternal(clone) {
        clone.name = this.name;

        const tags = this.tags._list;
        clone.tags.clear();
        for (let i = 0; i < tags.length; i++)
            clone.tags.add(tags[i]);

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

    /**
     * Clone a graph node.
     *
     * @returns {this} A clone of the specified graph node.
     */
    clone() {
        const clone = new this.constructor();
        this._cloneInternal(clone);
        return clone;
    }

    /**
     * Copy a graph node.
     *
     * @param {GraphNode} source - The graph node to copy.
     * @returns {GraphNode} The destination graph node.
     * @ignore
     */
    copy(source) {
        source._cloneInternal(this);
        return this;
    }


    /**
     * Destroy the graph node and all of its descendants. First, the graph node is removed from the
     * hierarchy. This is then repeated recursively for all descendants of the graph node.
     *
     * The last thing the graph node does is fire the `destroy` event.
     *
     * @example
     * const firstChild = graphNode.children[0];
     * firstChild.destroy(); // destroy child and all of its descendants
     */
    destroy() {
        // Detach from parent
        this.remove();

        // Recursively destroy all children
        const children = this._children;
        while (children.length) {
            // Remove last child from the array
            const child = children.pop();
            // Disconnect it from the parent: this is only an optimization step, to prevent calling
            // GraphNode#removeChild which would try to refind it via this._children.indexOf (which
            // will fail, because we just removed it).
            child._parent = null;
            child.destroy();
        }

        // fire destroy event
        this.fire('destroy', this);

        // clear all events
        this.off();
    }

    /**
     * Search the graph node and all of its descendants for the nodes that satisfy some search
     * criteria.
     *
     * @param {FindNodeCallback|string} attr - This can either be a function or a string. If it's a
     * function, it is executed for each descendant node to test if node satisfies the search
     * logic. Returning true from the function will include the node into the results. If it's a
     * string then it represents the name of a field or a method of the node. If this is the name
     * of a field then the value passed as the second argument will be checked for equality. If
     * this is the name of a function then the return value of the function will be checked for
     * equality against the valued passed as the second argument to this function.
     * @param {*} [value] - If the first argument (attr) is a property name then this value
     * will be checked against the value of the property.
     * @returns {GraphNode[]} The array of graph nodes that match the search criteria.
     * @example
     * // Finds all nodes that have a model component and have 'door' in their lower-cased name
     * const doors = house.find(function (node) {
     *     return node.model && node.name.toLowerCase().indexOf('door') !== -1;
     * });
     * @example
     * // Finds all nodes that have the name property set to 'Test'
     * const entities = parent.find('name', 'Test');
     */
    find(attr, value) {
        const results = [];
        const test = createTest(attr, value);

        this.forEach((node) => {
            if (test(node))
                results.push(node);
        });

        return results;
    }

    /**
     * Search the graph node and all of its descendants for the first node that satisfies some
     * search criteria.
     *
     * @param {FindNodeCallback|string} attr - This can either be a function or a string. If it's a
     * function, it is executed for each descendant node to test if node satisfies the search
     * logic. Returning true from the function will result in that node being returned from
     * findOne. If it's a string then it represents the name of a field or a method of the node. If
     * this is the name of a field then the value passed as the second argument will be checked for
     * equality. If this is the name of a function then the return value of the function will be
     * checked for equality against the valued passed as the second argument to this function.
     * @param {*} [value] - If the first argument (attr) is a property name then this value
     * will be checked against the value of the property.
     * @returns {GraphNode|null} A graph node that match the search criteria. Returns null if no
     * node is found.
     * @example
     * // Find the first node that is called 'head' and has a model component
     * const head = player.findOne(function (node) {
     *     return node.model && node.name === 'head';
     * });
     * @example
     * // Finds the first node that has the name property set to 'Test'
     * const node = parent.findOne('name', 'Test');
     */
    findOne(attr, value) {
        const test = createTest(attr, value);
        return findNode(this, test);
    }

    /**
     * Return all graph nodes that satisfy the search query. Query can be simply a string, or comma
     * separated strings, to have inclusive results of assets that match at least one query. A
     * query that consists of an array of tags can be used to match graph nodes that have each tag
     * of array.
     *
     * @param {...*} query - Name of a tag or array of tags.
     * @returns {GraphNode[]} A list of all graph nodes that match the query.
     * @example
     * // Return all graph nodes that tagged by `animal`
     * const animals = node.findByTag("animal");
     * @example
     * // Return all graph nodes that tagged by `bird` OR `mammal`
     * const birdsAndMammals = node.findByTag("bird", "mammal");
     * @example
     * // Return all assets that tagged by `carnivore` AND `mammal`
     * const meatEatingMammals = node.findByTag(["carnivore", "mammal"]);
     * @example
     * // Return all assets that tagged by (`carnivore` AND `mammal`) OR (`carnivore` AND `reptile`)
     * const meatEatingMammalsAndReptiles = node.findByTag(["carnivore", "mammal"], ["carnivore", "reptile"]);
     */
    findByTag() {
        const query = arguments;
        const results = [];

        const queryNode = (node, checkNode) => {
            if (checkNode && node.tags.has(...query)) {
                results.push(node);
            }

            for (let i = 0; i < node._children.length; i++) {
                queryNode(node._children[i], true);
            }
        };

        queryNode(this, false);

        return results;
    }

    /**
     * Get the first node found in the graph with the name. The search is depth first.
     *
     * @param {string} name - The name of the graph.
     * @returns {GraphNode|null} The first node to be found matching the supplied name. Returns
     * null if no node is found.
     */
    findByName(name) {
        return this.findOne('name', name);
    }

    /**
     * Get the first node found in the graph by its full path in the graph. The full path has this
     * form 'parent/child/sub-child'. The search is depth first.
     *
     * @param {string|string[]} path - The full path of the {@link GraphNode} as either a string or
     * array of {@link GraphNode} names.
     * @returns {GraphNode|null} The first node to be found matching the supplied path. Returns
     * null if no node is found.
     * @example
     * // String form
     * const grandchild = this.entity.findByPath('child/grandchild');
     * @example
     * // Array form
     * const grandchild = this.entity.findByPath(['child', 'grandchild']);
     */
    findByPath(path) {
        // accept either string path with '/' separators or array of parts.
        const parts = Array.isArray(path) ? path : path.split('/');

        let result = this;
        for (let i = 0, imax = parts.length; i < imax; ++i) {
            result = result.children.find(c => c.name === parts[i]);
            if (!result) {
                return null;
            }
        }

        return result;
    }

    /**
     * Executes a provided function once on this graph node and all of its descendants.
     *
     * @param {ForEachNodeCallback} callback - The function to execute on the graph node and each
     * descendant.
     * @param {object} [thisArg] - Optional value to use as this when executing callback function.
     * @example
     * // Log the path and name of each node in descendant tree starting with "parent"
     * parent.forEach(function (node) {
     *     console.log(node.path + "/" + node.name);
     * });
     */
    forEach(callback, thisArg) {
        callback.call(thisArg, this);

        const children = this._children;
        const len = children.length;
        for (let i = 0; i < len; ++i) {
            children[i].forEach(callback, thisArg);
        }
    }

    /**
     * Check if node is descendant of another node.
     *
     * @param {GraphNode} node - Potential ancestor of node.
     * @returns {boolean} If node is descendant of another node.
     * @example
     * if (roof.isDescendantOf(house)) {
     *     // roof is descendant of house entity
     * }
     */
    isDescendantOf(node) {
        let parent = this._parent;
        while (parent) {
            if (parent === node)
                return true;

            parent = parent._parent;
        }
        return false;
    }

    /**
     * Check if node is ancestor for another node.
     *
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
     * Get the world space rotation for the specified GraphNode in Euler angle form. The rotation
     * is returned as euler angles in a {@link Vec3}. The value returned by this function should be
     * considered read-only. In order to set the world space rotation of the graph node, use
     * {@link GraphNode#setEulerAngles}.
     *
     * @returns {Vec3} The world space rotation of the graph node in Euler angle form.
     * @example
     * const angles = this.entity.getEulerAngles();
     * angles.y = 180; // rotate the entity around Y by 180 degrees
     * this.entity.setEulerAngles(angles);
     */
    getEulerAngles() {
        this.getWorldTransform().getEulerAngles(this.eulerAngles);
        return this.eulerAngles;
    }

    /**
     * Get the rotation in local space for the specified GraphNode. The rotation is returned as
     * euler angles in a {@link Vec3}. The returned vector should be considered read-only. To
     * update the local rotation, use {@link GraphNode#setLocalEulerAngles}.
     *
     * @returns {Vec3} The local space rotation of the graph node as euler angles in XYZ order.
     * @example
     * const angles = this.entity.getLocalEulerAngles();
     * angles.y = 180;
     * this.entity.setLocalEulerAngles(angles);
     */
    getLocalEulerAngles() {
        this.localRotation.getEulerAngles(this.localEulerAngles);
        return this.localEulerAngles;
    }

    /**
     * Get the position in local space for the specified GraphNode. The position is returned as a
     * {@link Vec3}. The returned vector should be considered read-only. To update the local
     * position, use {@link GraphNode#setLocalPosition}.
     *
     * @returns {Vec3} The local space position of the graph node.
     * @example
     * const position = this.entity.getLocalPosition();
     * position.x += 1; // move the entity 1 unit along x.
     * this.entity.setLocalPosition(position);
     */
    getLocalPosition() {
        return this.localPosition;
    }

    /**
     * Get the rotation in local space for the specified GraphNode. The rotation is returned as a
     * {@link Quat}. The returned quaternion should be considered read-only. To update the local
     * rotation, use {@link GraphNode#setLocalRotation}.
     *
     * @returns {Quat} The local space rotation of the graph node as a quaternion.
     * @example
     * const rotation = this.entity.getLocalRotation();
     */
    getLocalRotation() {
        return this.localRotation;
    }

    /**
     * Get the scale in local space for the specified GraphNode. The scale is returned as a
     * {@link Vec3}. The returned vector should be considered read-only. To update the local scale,
     * use {@link GraphNode#setLocalScale}.
     *
     * @returns {Vec3} The local space scale of the graph node.
     * @example
     * const scale = this.entity.getLocalScale();
     * scale.x = 100;
     * this.entity.setLocalScale(scale);
     */
    getLocalScale() {
        return this.localScale;
    }

    /**
     * Get the local transform matrix for this graph node. This matrix is the transform relative to
     * the node's parent's world transformation matrix.
     *
     * @returns {Mat4} The node's local transformation matrix.
     * @example
     * const transform = this.entity.getLocalTransform();
     */
    getLocalTransform() {
        if (this._dirtyLocal) {
            this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);
            this._dirtyLocal = false;
        }
        return this.localTransform;
    }

    /**
     * Get the world space position for the specified GraphNode. The position is returned as a
     * {@link Vec3}. The value returned by this function should be considered read-only. In order
     * to set the world space position of the graph node, use {@link GraphNode#setPosition}.
     *
     * @returns {Vec3} The world space position of the graph node.
     * @example
     * const position = this.entity.getPosition();
     * position.x = 10;
     * this.entity.setPosition(position);
     */
    getPosition() {
        this.getWorldTransform().getTranslation(this.position);
        return this.position;
    }

    /**
     * Get the world space rotation for the specified GraphNode. The rotation is returned as a
     * {@link Quat}. The value returned by this function should be considered read-only. In order
     * to set the world space rotation of the graph node, use {@link GraphNode#setRotation}.
     *
     * @returns {Quat} The world space rotation of the graph node as a quaternion.
     * @example
     * const rotation = this.entity.getRotation();
     */
    getRotation() {
        this.rotation.setFromMat4(this.getWorldTransform());
        return this.rotation;
    }

    /**
     * Get the world space scale for the specified GraphNode. The returned value will only be
     * correct for graph nodes that have a non-skewed world transform (a skew can be introduced by
     * the compounding of rotations and scales higher in the graph node hierarchy). The scale is
     * returned as a {@link Vec3}. The value returned by this function should be considered
     * read-only. Note that it is not possible to set the world space scale of a graph node
     * directly.
     *
     * @returns {Vec3} The world space scale of the graph node.
     * @example
     * const scale = this.entity.getScale();
     * @ignore
     */
    getScale() {
        if (!this._scale) {
            this._scale = new Vec3();
        }
        return this.getWorldTransform().getScale(this._scale);
    }

    /**
     * Get the world transformation matrix for this graph node.
     *
     * @returns {Mat4} The node's world transformation matrix.
     * @example
     * const transform = this.entity.getWorldTransform();
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
     * Gets the cached value of negative scale sign of the world transform.
     *
     * @returns {number} -1 if world transform has negative scale, 1 otherwise.
     * @ignore
     */
    get worldScaleSign() {

        if (this._worldScaleSign === 0) {
            this._worldScaleSign = this.getWorldTransform().scaleSign;
        }

        return this._worldScaleSign;
    }

    /**
     * Remove graph node from current parent.
     */
    remove() {
        this._parent?.removeChild(this);
    }

    /**
     * Remove graph node from current parent and add as child to new parent.
     *
     * @param {GraphNode} parent - New parent to attach graph node to.
     * @param {number} [index] - The child index where the child node should be placed.
     */
    reparent(parent, index) {
        this.remove();
        if (parent) {
            if (index >= 0) {
                parent.insertChild(this, index);
            } else {
                parent.addChild(this);
            }
        }
    }

    /**
     * Sets the local space rotation of the specified graph node using euler angles. Eulers are
     * interpreted in XYZ order. Eulers must be specified in degrees. This function has two valid
     * signatures: you can either pass a 3D vector or 3 numbers to specify the local space euler
     * rotation.
     *
     * @param {Vec3|number} x - 3-dimensional vector holding eulers or rotation around local space
     * x-axis in degrees.
     * @param {number} [y] - Rotation around local space y-axis in degrees.
     * @param {number} [z] - Rotation around local space z-axis in degrees.
     * @example
     * // Set rotation of 90 degrees around y-axis via 3 numbers
     * this.entity.setLocalEulerAngles(0, 90, 0);
     * @example
     * // Set rotation of 90 degrees around y-axis via a vector
     * const angles = new pc.Vec3(0, 90, 0);
     * this.entity.setLocalEulerAngles(angles);
     */
    setLocalEulerAngles(x, y, z) {
        this.localRotation.setFromEulerAngles(x, y, z);

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * Sets the local space position of the specified graph node. This function has two valid
     * signatures: you can either pass a 3D vector or 3 numbers to specify the local space
     * position.
     *
     * @param {Vec3|number} x - 3-dimensional vector holding local space position or
     * x-coordinate of local space position.
     * @param {number} [y] - Y-coordinate of local space position.
     * @param {number} [z] - Z-coordinate of local space position.
     * @example
     * // Set via 3 numbers
     * this.entity.setLocalPosition(0, 10, 0);
     * @example
     * // Set via vector
     * const pos = new pc.Vec3(0, 10, 0);
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
     * Sets the local space rotation of the specified graph node. This function has two valid
     * signatures: you can either pass a quaternion or 3 numbers to specify the local space
     * rotation.
     *
     * @param {Quat|number} x - Quaternion holding local space rotation or x-component of
     * local space quaternion rotation.
     * @param {number} [y] - Y-component of local space quaternion rotation.
     * @param {number} [z] - Z-component of local space quaternion rotation.
     * @param {number} [w] - W-component of local space quaternion rotation.
     * @example
     * // Set via 4 numbers
     * this.entity.setLocalRotation(0, 0, 0, 1);
     * @example
     * // Set via quaternion
     * const q = pc.Quat();
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
     * Sets the local space scale factor of the specified graph node. This function has two valid
     * signatures: you can either pass a 3D vector or 3 numbers to specify the local space scale.
     *
     * @param {Vec3|number} x - 3-dimensional vector holding local space scale or x-coordinate
     * of local space scale.
     * @param {number} [y] - Y-coordinate of local space scale.
     * @param {number} [z] - Z-coordinate of local space scale.
     * @example
     * // Set via 3 numbers
     * this.entity.setLocalScale(10, 10, 10);
     * @example
     * // Set via vector
     * const scale = new pc.Vec3(10, 10, 10);
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

    /** @private */
    _dirtifyLocal() {
        if (!this._dirtyLocal) {
            this._dirtyLocal = true;
            if (!this._dirtyWorld)
                this._dirtifyWorld();
        }
    }

    /** @private */
    _unfreezeParentToRoot() {
        let p = this._parent;
        while (p) {
            p._frozen = false;
            p = p._parent;
        }
    }

    /** @private */
    _dirtifyWorld() {
        if (!this._dirtyWorld)
            this._unfreezeParentToRoot();
        this._dirtifyWorldInternal();
    }

    /** @private */
    _dirtifyWorldInternal() {
        if (!this._dirtyWorld) {
            this._frozen = false;
            this._dirtyWorld = true;
            for (let i = 0; i < this._children.length; i++) {
                if (!this._children[i]._dirtyWorld)
                    this._children[i]._dirtifyWorldInternal();
            }
        }
        this._dirtyNormal = true;
        this._worldScaleSign = 0;   // world matrix is dirty, mark this flag dirty too
        this._aabbVer++;
    }

    /**
     * Sets the world space position of the specified graph node. This function has two valid
     * signatures: you can either pass a 3D vector or 3 numbers to specify the world space
     * position.
     *
     * @param {Vec3|number} x - 3-dimensional vector holding world space position or
     * x-coordinate of world space position.
     * @param {number} [y] - Y-coordinate of world space position.
     * @param {number} [z] - Z-coordinate of world space position.
     * @example
     * // Set via 3 numbers
     * this.entity.setPosition(0, 10, 0);
     * @example
     * // Set via vector
     * const position = new pc.Vec3(0, 10, 0);
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
     * Sets the world space rotation of the specified graph node. This function has two valid
     * signatures: you can either pass a quaternion or 3 numbers to specify the world space
     * rotation.
     *
     * @param {Quat|number} x - Quaternion holding world space rotation or x-component of
     * world space quaternion rotation.
     * @param {number} [y] - Y-component of world space quaternion rotation.
     * @param {number} [z] - Z-component of world space quaternion rotation.
     * @param {number} [w] - W-component of world space quaternion rotation.
     * @example
     * // Set via 4 numbers
     * this.entity.setRotation(0, 0, 0, 1);
     * @example
     * // Set via quaternion
     * const q = pc.Quat();
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
            const parentRot = this._parent.getRotation();
            invParentRot.copy(parentRot).invert();
            this.localRotation.copy(invParentRot).mul(rotation);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * Sets the world space position and rotation of the specified graph node. This is faster than
     * setting the position and rotation independently.
     *
     * @param {Vec3} position - The world space position to set.
     * @param {Quat} rotation - The world space rotation to set.
     * @example
     * const position = new pc.Vec3(0, 10, 0);
     * const rotation = new pc.Quat().setFromEulerAngles(0, 90, 0);
     * this.entity.setPositionAndRotation(position, rotation);
     */
    setPositionAndRotation(position, rotation) {
        if (this._parent === null) {
            this.localPosition.copy(position);
            this.localRotation.copy(rotation);
        } else {
            const parentWtm = this._parent.getWorldTransform();
            invParentWtm.copy(parentWtm).invert();
            invParentWtm.transformPoint(position, this.localPosition);
            this.localRotation.setFromMat4(invParentWtm).mul(rotation);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * Sets the world space rotation of the specified graph node using euler angles. Eulers are
     * interpreted in XYZ order. Eulers must be specified in degrees. This function has two valid
     * signatures: you can either pass a 3D vector or 3 numbers to specify the world space euler
     * rotation.
     *
     * @param {Vec3|number} x - 3-dimensional vector holding eulers or rotation around world space
     * x-axis in degrees.
     * @param {number} [y] - Rotation around world space y-axis in degrees.
     * @param {number} [z] - Rotation around world space z-axis in degrees.
     * @example
     * // Set rotation of 90 degrees around world space y-axis via 3 numbers
     * this.entity.setEulerAngles(0, 90, 0);
     * @example
     * // Set rotation of 90 degrees around world space y-axis via a vector
     * const angles = new pc.Vec3(0, 90, 0);
     * this.entity.setEulerAngles(angles);
     */
    setEulerAngles(x, y, z) {
        this.localRotation.setFromEulerAngles(x, y, z);

        if (this._parent !== null) {
            const parentRot = this._parent.getRotation();
            invParentRot.copy(parentRot).invert();
            this.localRotation.mul2(invParentRot, this.localRotation);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * Add a new child to the child list and update the parent value of the child node.
     * If the node already had a parent, it is removed from its child list.
     *
     * @param {GraphNode} node - The new child to add.
     * @example
     * const e = new pc.Entity(app);
     * this.entity.addChild(e);
     */
    addChild(node) {
        this._prepareInsertChild(node);
        this._children.push(node);
        this._onInsertChild(node);
    }

    /**
     * Add a child to this node, maintaining the child's transform in world space.
     * If the node already had a parent, it is removed from its child list.
     *
     * @param {GraphNode} node - The child to add.
     * @example
     * const e = new pc.Entity(app);
     * this.entity.addChildAndSaveTransform(e);
     * @ignore
     */
    addChildAndSaveTransform(node) {

        const wPos = node.getPosition();
        const wRot = node.getRotation();

        this._prepareInsertChild(node);

        node.setPosition(tmpMat4.copy(this.worldTransform).invert().transformPoint(wPos));
        node.setRotation(tmpQuat.copy(this.getRotation()).invert().mul(wRot));

        this._children.push(node);
        this._onInsertChild(node);
    }

    /**
     * Insert a new child to the child list at the specified index and update the parent value of
     * the child node. If the node already had a parent, it is removed from its child list.
     *
     * @param {GraphNode} node - The new child to insert.
     * @param {number} index - The index in the child list of the parent where the new node will be
     * inserted.
     * @example
     * const e = new pc.Entity(app);
     * this.entity.insertChild(e, 1);
     */
    insertChild(node, index) {

        this._prepareInsertChild(node);
        this._children.splice(index, 0, node);
        this._onInsertChild(node);
    }

    /**
     * Prepares node for being inserted to a parent node, and removes it from the previous parent.
     *
     * @param {GraphNode} node - The node being inserted.
     * @private
     */
    _prepareInsertChild(node) {

        // remove it from the existing parent
        node.remove();

        Debug.assert(node !== this, `GraphNode ${node?.name} cannot be a child of itself`);
        Debug.assert(!this.isDescendantOf(node), `GraphNode ${node?.name} cannot add an ancestor as a child`);
    }

    /**
     * Fires an event on all children of the node. The event `name` is fired on the first (root)
     * node only. The event `nameHierarchy` is fired for all children.
     *
     * @param {string} name - The name of the event to fire on the root.
     * @param {string} nameHierarchy - The name of the event to fire for all descendants.
     * @param {GraphNode} parent - The parent of the node being added/removed from the hierarchy.
     * @private
     */
    _fireOnHierarchy(name, nameHierarchy, parent) {
        this.fire(name, parent);
        for (let i = 0; i < this._children.length; i++) {
            this._children[i]._fireOnHierarchy(nameHierarchy, nameHierarchy, parent);
        }
    }

    /**
     * Called when a node is inserted into a node's child list.
     *
     * @param {GraphNode} node - The node that was inserted.
     * @private
     */
    _onInsertChild(node) {
        node._parent = this;

        // the child node should be enabled in the hierarchy only if itself is enabled and if
        // this parent is enabled
        const enabledInHierarchy = (node._enabled && this.enabled);
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

        // alert an entity hierarchy that it has been inserted
        node._fireOnHierarchy('insert', 'inserthierarchy', this);

        // alert the parent that it has had a child inserted
        if (this.fire) this.fire('childinsert', node);
    }

    /**
     * Recurse the hierarchy and update the graph depth at each node.
     *
     * @private
     */
    _updateGraphDepth() {
        this._graphDepth = this._parent ? this._parent._graphDepth + 1 : 0;

        for (let i = 0, len = this._children.length; i < len; i++) {
            this._children[i]._updateGraphDepth();
        }
    }

    /**
     * Remove the node from the child list and update the parent value of the child.
     *
     * @param {GraphNode} child - The node to remove.
     * @example
     * const child = this.entity.children[0];
     * this.entity.removeChild(child);
     */
    removeChild(child) {
        const index = this._children.indexOf(child);
        if (index === -1) {
            return;
        }

        // Remove from child list
        this._children.splice(index, 1);

        // Clear parent
        child._parent = null;

        // NOTE: see PR #4047 - this fix is removed for now as it breaks other things
        // notify the child hierarchy it has been removed from the parent,
        // which marks them as not enabled in hierarchy
        // if (child._enabledInHierarchy) {
        //     child._notifyHierarchyStateChanged(child, false);
        // }

        // alert children that they has been removed
        child._fireOnHierarchy('remove', 'removehierarchy', this);

        // alert the parent that it has had a child removed
        this.fire('childremove', child);
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
                    let parentWorldScale;
                    const parent = this._parent;

                    // Find a parent of the first uncompensated node up in the hierarchy and use its scale * localScale
                    let scale = this.localScale;
                    let parentToUseScaleFrom = parent; // current parent
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
                    let tmatrix = parent.worldTransform;
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
     * Updates the world transformation matrices at this node and all of its descendants.
     *
     * @ignore
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

        const children = this._children;
        for (let i = 0, len = children.length; i < len; i++) {
            children[i].syncHierarchy();
        }
    }

    /**
     * Reorients the graph node so that the negative z-axis points towards the target. This
     * function has two valid signatures. Either pass 3D vectors for the look at coordinate and up
     * vector, or pass numbers to represent the vectors.
     *
     * @param {Vec3|number} x - If passing a 3D vector, this is the world space coordinate to look at.
     * Otherwise, it is the x-component of the world space coordinate to look at.
     * @param {Vec3|number} [y] - If passing a 3D vector, this is the world space up vector for look at
     * transform. Otherwise, it is the y-component of the world space coordinate to look at.
     * @param {number} [z] - Z-component of the world space coordinate to look at.
     * @param {number} [ux] - X-component of the up vector for the look at transform. Defaults to 0.
     * @param {number} [uy] - Y-component of the up vector for the look at transform. Defaults to 1.
     * @param {number} [uz] - Z-component of the up vector for the look at transform. Defaults to 0.
     * @example
     * // Look at another entity, using the (default) positive y-axis for up
     * const position = otherEntity.getPosition();
     * this.entity.lookAt(position);
     * @example
     * // Look at another entity, using the negative world y-axis for up
     * const position = otherEntity.getPosition();
     * this.entity.lookAt(position, pc.Vec3.DOWN);
     * @example
     * // Look at the world space origin, using the (default) positive y-axis for up
     * this.entity.lookAt(0, 0, 0);
     * @example
     * // Look at world space coordinate [10, 10, 10], using the negative world y-axis for up
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
     * Translates the graph node in world space by the specified translation vector. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * world space translation.
     *
     * @param {Vec3|number} x - 3-dimensional vector holding world space translation or
     * x-coordinate of world space translation.
     * @param {number} [y] - Y-coordinate of world space translation.
     * @param {number} [z] - Z-coordinate of world space translation.
     * @example
     * // Translate via 3 numbers
     * this.entity.translate(10, 0, 0);
     * @example
     * // Translate via vector
     * const t = new pc.Vec3(10, 0, 0);
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
     * Translates the graph node in local space by the specified translation vector. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * local space translation.
     *
     * @param {Vec3|number} x - 3-dimensional vector holding local space translation or
     * x-coordinate of local space translation.
     * @param {number} [y] - Y-coordinate of local space translation.
     * @param {number} [z] - Z-coordinate of local space translation.
     * @example
     * // Translate via 3 numbers
     * this.entity.translateLocal(10, 0, 0);
     * @example
     * // Translate via vector
     * const t = new pc.Vec3(10, 0, 0);
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
     * Rotates the graph node in world space by the specified Euler angles. Eulers are specified in
     * degrees in XYZ order. This function has two valid signatures: you can either pass a 3D
     * vector or 3 numbers to specify the world space rotation.
     *
     * @param {Vec3|number} x - 3-dimensional vector holding world space rotation or
     * rotation around world space x-axis in degrees.
     * @param {number} [y] - Rotation around world space y-axis in degrees.
     * @param {number} [z] - Rotation around world space z-axis in degrees.
     * @example
     * // Rotate via 3 numbers
     * this.entity.rotate(0, 90, 0);
     * @example
     * // Rotate via vector
     * const r = new pc.Vec3(0, 90, 0);
     * this.entity.rotate(r);
     */
    rotate(x, y, z) {
        rotation.setFromEulerAngles(x, y, z);

        if (this._parent === null) {
            this.localRotation.mul2(rotation, this.localRotation);
        } else {
            const rot = this.getRotation();
            const parentRot = this._parent.getRotation();

            invParentRot.copy(parentRot).invert();
            rotation.mul2(invParentRot, rotation);
            this.localRotation.mul2(rotation, rot);
        }

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }

    /**
     * Rotates the graph node in local space by the specified Euler angles. Eulers are specified in
     * degrees in XYZ order. This function has two valid signatures: you can either pass a 3D
     * vector or 3 numbers to specify the local space rotation.
     *
     * @param {Vec3|number} x - 3-dimensional vector holding local space rotation or
     * rotation around local space x-axis in degrees.
     * @param {number} [y] - Rotation around local space y-axis in degrees.
     * @param {number} [z] - Rotation around local space z-axis in degrees.
     * @example
     * // Rotate via 3 numbers
     * this.entity.rotateLocal(0, 90, 0);
     * @example
     * // Rotate via vector
     * const r = new pc.Vec3(0, 90, 0);
     * this.entity.rotateLocal(r);
     */
    rotateLocal(x, y, z) {
        rotation.setFromEulerAngles(x, y, z);

        this.localRotation.mul(rotation);

        if (!this._dirtyLocal)
            this._dirtifyLocal();
    }
}

export { GraphNode };
