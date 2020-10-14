import { EventHandler } from '../core/event-handler.js';
import { Tags } from '../core/tags.js';

/*
text = "";
for (var name in assemblyscript.instance.exports) {
    if (!name.startsWith("GraphNode#"))
        continue;
    var funcname = name.replace("GraphNode#", "").replace(":", "ter$").toLowerCase().padEnd(40);
    var importname = 
    text += "var ";
    text += funcname;
    text +=" = assemblyscript.instance.exports[\"";
    text += name;
    text += "\"];\n";
}
text;
*/
var getter$name                              = assemblyscript.instance.exports["GraphNode#get:name"];
var setter$name                              = assemblyscript.instance.exports["GraphNode#set:name"];
var getter$localposition                     = assemblyscript.instance.exports["GraphNode#get:localPosition"];
var setter$localposition                     = assemblyscript.instance.exports["GraphNode#set:localPosition"];
var getter$localrotation                     = assemblyscript.instance.exports["GraphNode#get:localRotation"];
var setter$localrotation                     = assemblyscript.instance.exports["GraphNode#set:localRotation"];
var getter$localscale                        = assemblyscript.instance.exports["GraphNode#get:localScale"];
var setter$localscale                        = assemblyscript.instance.exports["GraphNode#set:localScale"];
var getter$localeulerangles                  = assemblyscript.instance.exports["GraphNode#get:localEulerAngles"];
var setter$localeulerangles                  = assemblyscript.instance.exports["GraphNode#set:localEulerAngles"];
var getter$position                          = assemblyscript.instance.exports["GraphNode#get:position"];
var setter$position                          = assemblyscript.instance.exports["GraphNode#set:position"];
var getter$rotation                          = assemblyscript.instance.exports["GraphNode#get:rotation"];
var setter$rotation                          = assemblyscript.instance.exports["GraphNode#set:rotation"];
var getter$eulerangles                       = assemblyscript.instance.exports["GraphNode#get:eulerAngles"];
var setter$eulerangles                       = assemblyscript.instance.exports["GraphNode#set:eulerAngles"];
var getter$_scale                            = assemblyscript.instance.exports["GraphNode#get:_scale"];
var setter$_scale                            = assemblyscript.instance.exports["GraphNode#set:_scale"];
var getter$localtransform                    = assemblyscript.instance.exports["GraphNode#get:localTransform"];
var setter$localtransform                    = assemblyscript.instance.exports["GraphNode#set:localTransform"];
var getter$_dirtylocal                       = assemblyscript.instance.exports["GraphNode#get:_dirtyLocal"];
var setter$_dirtylocal                       = assemblyscript.instance.exports["GraphNode#set:_dirtyLocal"];
var getter$_aabbver                          = assemblyscript.instance.exports["GraphNode#get:_aabbVer"];
var setter$_aabbver                          = assemblyscript.instance.exports["GraphNode#set:_aabbVer"];
var getter$_frozen                           = assemblyscript.instance.exports["GraphNode#get:_frozen"];
var setter$_frozen                           = assemblyscript.instance.exports["GraphNode#set:_frozen"];
var getter$worldtransform                    = assemblyscript.instance.exports["GraphNode#get:worldTransform"];
var setter$worldtransform                    = assemblyscript.instance.exports["GraphNode#set:worldTransform"];
var getter$_dirtyworld                       = assemblyscript.instance.exports["GraphNode#get:_dirtyWorld"];
var setter$_dirtyworld                       = assemblyscript.instance.exports["GraphNode#set:_dirtyWorld"];
var getter$normalmatrix                      = assemblyscript.instance.exports["GraphNode#get:normalMatrix"];
var setter$normalmatrix                      = assemblyscript.instance.exports["GraphNode#set:normalMatrix"];
var getter$_dirtynormal                      = assemblyscript.instance.exports["GraphNode#get:_dirtyNormal"];
var setter$_dirtynormal                      = assemblyscript.instance.exports["GraphNode#set:_dirtyNormal"];
var getter$_right                            = assemblyscript.instance.exports["GraphNode#get:_right"];
var setter$_right                            = assemblyscript.instance.exports["GraphNode#set:_right"];
var getter$_up                               = assemblyscript.instance.exports["GraphNode#get:_up"];
var setter$_up                               = assemblyscript.instance.exports["GraphNode#set:_up"];
var getter$_forward                          = assemblyscript.instance.exports["GraphNode#get:_forward"];
var setter$_forward                          = assemblyscript.instance.exports["GraphNode#set:_forward"];
var getter$_parent                           = assemblyscript.instance.exports["GraphNode#get:_parent"];
var setter$_parent                           = assemblyscript.instance.exports["GraphNode#set:_parent"];
var getter$_children                         = assemblyscript.instance.exports["GraphNode#get:_children"];
var setter$_children                         = assemblyscript.instance.exports["GraphNode#set:_children"];
var getter$_graphdepth                       = assemblyscript.instance.exports["GraphNode#get:_graphDepth"];
var setter$_graphdepth                       = assemblyscript.instance.exports["GraphNode#set:_graphDepth"];
var getter$_enabled                          = assemblyscript.instance.exports["GraphNode#get:_enabled"];
var setter$_enabled                          = assemblyscript.instance.exports["GraphNode#set:_enabled"];
var getter$_enabledinhierarchy               = assemblyscript.instance.exports["GraphNode#get:_enabledInHierarchy"];
var setter$_enabledinhierarchy               = assemblyscript.instance.exports["GraphNode#set:_enabledInHierarchy"];
var getter$scalecompensation                 = assemblyscript.instance.exports["GraphNode#get:scaleCompensation"];
var setter$scalecompensation                 = assemblyscript.instance.exports["GraphNode#set:scaleCompensation"];
var constructor                              = assemblyscript.instance.exports["GraphNode#constructor"];
var getter$right                             = assemblyscript.instance.exports["GraphNode#get:right"];
var getter$up                                = assemblyscript.instance.exports["GraphNode#get:up"];
var getter$forward                           = assemblyscript.instance.exports["GraphNode#get:forward"];
var getter$enabled                           = assemblyscript.instance.exports["GraphNode#get:enabled"];
var setter$enabled                           = assemblyscript.instance.exports["GraphNode#set:enabled"];
var getter$parent                            = assemblyscript.instance.exports["GraphNode#get:parent"];
var getter$path                              = assemblyscript.instance.exports["GraphNode#get:path"];
var getter$root                              = assemblyscript.instance.exports["GraphNode#get:root"];
var getter$children                          = assemblyscript.instance.exports["GraphNode#get:children"];
var getter$graphdepth                        = assemblyscript.instance.exports["GraphNode#get:graphDepth"];
var _notifyhierarchystatechanged             = assemblyscript.instance.exports["GraphNode#_notifyHierarchyStateChanged"];
var _onhierarchystatechanged                 = assemblyscript.instance.exports["GraphNode#_onHierarchyStateChanged"];
var _cloneinternal                           = assemblyscript.instance.exports["GraphNode#_cloneInternal"];
var clone                                    = assemblyscript.instance.exports["GraphNode#clone"];
var isdescendantof                           = assemblyscript.instance.exports["GraphNode#isDescendantOf"];
var isancestorof                             = assemblyscript.instance.exports["GraphNode#isAncestorOf"];
var geteulerangles                           = assemblyscript.instance.exports["GraphNode#getEulerAngles"];
var getlocaleulerangles                      = assemblyscript.instance.exports["GraphNode#getLocalEulerAngles"];
var getlocalposition                         = assemblyscript.instance.exports["GraphNode#getLocalPosition"];
var getlocalrotation                         = assemblyscript.instance.exports["GraphNode#getLocalRotation"];
var getlocalscale                            = assemblyscript.instance.exports["GraphNode#getLocalScale"];
var getlocaltransform                        = assemblyscript.instance.exports["GraphNode#getLocalTransform"];
var getposition                              = assemblyscript.instance.exports["GraphNode#getPosition"];
var getrotation                              = assemblyscript.instance.exports["GraphNode#getRotation"];
var getscale                                 = assemblyscript.instance.exports["GraphNode#getScale"];
var getworldtransform                        = assemblyscript.instance.exports["GraphNode#getWorldTransform"];
var reparent                                 = assemblyscript.instance.exports["GraphNode#reparent"];
var setlocaleulerangles                      = assemblyscript.instance.exports["GraphNode#setLocalEulerAngles"];
var setlocalposition                         = assemblyscript.instance.exports["GraphNode#setLocalPosition"];
var setlocalrotation                         = assemblyscript.instance.exports["GraphNode#setLocalRotation"];
var setlocalscale                            = assemblyscript.instance.exports["GraphNode#setLocalScale"];
var _dirtifylocal                            = assemblyscript.instance.exports["GraphNode#_dirtifyLocal"];
var _unfreezeparenttoroot                    = assemblyscript.instance.exports["GraphNode#_unfreezeParentToRoot"];
var _dirtifyworld                            = assemblyscript.instance.exports["GraphNode#_dirtifyWorld"];
var _dirtifyworldinternal                    = assemblyscript.instance.exports["GraphNode#_dirtifyWorldInternal"];
var getter$setposition_position              = assemblyscript.instance.exports["GraphNode#get:setPosition_position"];
var setter$setposition_position              = assemblyscript.instance.exports["GraphNode#set:setPosition_position"];
var getter$setposition_invparentwtm          = assemblyscript.instance.exports["GraphNode#get:setPosition_invParentWtm"];
var setter$setposition_invparentwtm          = assemblyscript.instance.exports["GraphNode#set:setPosition_invParentWtm"];
var setposition                              = assemblyscript.instance.exports["GraphNode#setPosition"];
var getter$setrotation_rotation              = assemblyscript.instance.exports["GraphNode#get:setRotation_rotation"];
var setter$setrotation_rotation              = assemblyscript.instance.exports["GraphNode#set:setRotation_rotation"];
var getter$setrotation_invparentrot          = assemblyscript.instance.exports["GraphNode#get:setRotation_invParentRot"];
var setter$setrotation_invparentrot          = assemblyscript.instance.exports["GraphNode#set:setRotation_invParentRot"];
var setrotation                              = assemblyscript.instance.exports["GraphNode#setRotation"];
var getter$seteulerangles_invparentrot       = assemblyscript.instance.exports["GraphNode#get:setEulerAngles_invParentRot"];
var setter$seteulerangles_invparentrot       = assemblyscript.instance.exports["GraphNode#set:setEulerAngles_invParentRot"];
var seteulerangles                           = assemblyscript.instance.exports["GraphNode#setEulerAngles"];
var addchild                                 = assemblyscript.instance.exports["GraphNode#addChild"];
var insertchild                              = assemblyscript.instance.exports["GraphNode#insertChild"];
var _debuginsertchild                        = assemblyscript.instance.exports["GraphNode#_debugInsertChild"];
var _oninsertchild                           = assemblyscript.instance.exports["GraphNode#_onInsertChild"];
var _updategraphdepth                        = assemblyscript.instance.exports["GraphNode#_updateGraphDepth"];
var removechild                              = assemblyscript.instance.exports["GraphNode#removeChild"];
var getter$_sync_scale                       = assemblyscript.instance.exports["GraphNode#get:_sync_scale"];
var setter$_sync_scale                       = assemblyscript.instance.exports["GraphNode#set:_sync_scale"];
var _sync                                    = assemblyscript.instance.exports["GraphNode#_sync"];
var synchierarchy                            = assemblyscript.instance.exports["GraphNode#syncHierarchy"];
var getter$lookat_matrix                     = assemblyscript.instance.exports["GraphNode#get:lookAt_matrix"];
var setter$lookat_matrix                     = assemblyscript.instance.exports["GraphNode#set:lookAt_matrix"];
var getter$lookat_target                     = assemblyscript.instance.exports["GraphNode#get:lookAt_target"];
var setter$lookat_target                     = assemblyscript.instance.exports["GraphNode#set:lookAt_target"];
var getter$lookat_up                         = assemblyscript.instance.exports["GraphNode#get:lookAt_up"];
var setter$lookat_up                         = assemblyscript.instance.exports["GraphNode#set:lookAt_up"];
var getter$lookat_rotation                   = assemblyscript.instance.exports["GraphNode#get:lookAt_rotation"];
var setter$lookat_rotation                   = assemblyscript.instance.exports["GraphNode#set:lookAt_rotation"];
var lookat                                   = assemblyscript.instance.exports["GraphNode#lookAt"];
var getter$translate_translation             = assemblyscript.instance.exports["GraphNode#get:translate_translation"];
var setter$translate_translation             = assemblyscript.instance.exports["GraphNode#set:translate_translation"];
var translate                                = assemblyscript.instance.exports["GraphNode#translate"];
var getter$translatelocal_translation        = assemblyscript.instance.exports["GraphNode#get:translateLocal_translation"];
var setter$translatelocal_translation        = assemblyscript.instance.exports["GraphNode#set:translateLocal_translation"];
var translatelocal                           = assemblyscript.instance.exports["GraphNode#translateLocal"];
var getter$rotate_quaternion                 = assemblyscript.instance.exports["GraphNode#get:rotate_quaternion"];
var setter$rotate_quaternion                 = assemblyscript.instance.exports["GraphNode#set:rotate_quaternion"];
var getter$rotate_invparentrot               = assemblyscript.instance.exports["GraphNode#get:rotate_invParentRot"];
var setter$rotate_invparentrot               = assemblyscript.instance.exports["GraphNode#set:rotate_invParentRot"];
var rotate                                   = assemblyscript.instance.exports["GraphNode#rotate"];
var getter$rotatelocal_quaternion            = assemblyscript.instance.exports["GraphNode#get:rotateLocal_quaternion"];
var setter$rotatelocal_quaternion            = assemblyscript.instance.exports["GraphNode#set:rotateLocal_quaternion"];
var rotatelocal                              = assemblyscript.instance.exports["GraphNode#rotateLocal"];

/**
 * @class
 * @name pc.GraphNode
 * @augments pc.EventHandler
 * @classdesc A hierarchical scene node.
 * @param {string} [name] - The non-unique name of the graph node, default is "Untitled".
 * @property {string} name The non-unique name of a graph node.
 * @property {pc.Tags} tags Interface for tagging graph nodes. Tag based searches can be performed using the {@link pc.GraphNode#findByTag} function.
 */
function GraphNode(name) {
    EventHandler.call(this);
    this.tags = new Tags(this);
    this._labels = {};
    if (typeof name === "string") {
        var strptr = Loader.allocString(name);
        assemblyscript.instance.exports.__setArgumentsLength(1);
        this.ptr = constructor(0, strptr);
    } else {
        assemblyscript.instance.exports.__setArgumentsLength(0);
        this.ptr = constructor(0);
    }
}

GraphNode.prototype = Object.create(EventHandler.prototype);
GraphNode.prototype.constructor = GraphNode;

/**
 * @name pc.GraphNode#name
 * @type {string}
 */
Object.defineProperty(GraphNode.prototype, 'name', {
    get: function () {
        var strptr = getter$name(this.ptr)
        return Loader.getString(strptr);
    },
    set(newName) {
        var strptr = Loader.allocString(newName);
        setter$name(this.ptr, strptr);
    }
});

/**
 * @readonly
 * @name pc.GraphNode#right
 * @type {pc.Vec3}
 * @description The normalized local space X-axis vector of the graph node in world space.
 */
Object.defineProperty(GraphNode.prototype, 'right', {
    get: function () {
        //if (!this._right) {
        //    this._right = new Vec3();
        //}
        //return this.getWorldTransform().getX(this._right).normalize();
    }
});

/**
 * @readonly
 * @name pc.GraphNode#up
 * @type {pc.Vec3}
 * @description The normalized local space Y-axis vector of the graph node in world space.
 */
Object.defineProperty(GraphNode.prototype, 'up', {
    get: function () {
        //if (!this._up) {
        //    this._up = new Vec3();
        //}
        //return this.getWorldTransform().getY(this._up).normalize();
    }
});

/**
 * @readonly
 * @name pc.GraphNode#forward
 * @type {pc.Vec3}
 * @description The normalized local space negative Z-axis vector of the graph node in world space.
 */
Object.defineProperty(GraphNode.prototype, 'forward', {
    get: function () {
        //if (!this._forward) {
        //    this._forward = new Vec3();
        //}
        //return this.getWorldTransform().getZ(this._forward).normalize().scale(-1);
    }
});

/**
 * @name pc.GraphNode#enabled
 * @type {boolean}
 * @description Enable or disable a GraphNode. If one of the GraphNode's parents is disabled
 * there will be no other side effects. If all the parents are enabled then
 * the new value will activate / deactivate all the enabled children of the GraphNode.
 */
Object.defineProperty(GraphNode.prototype, 'enabled', {
    get: function () {
        // make sure to check this._enabled too because if that
        // was false when a parent was updated the _enabledInHierarchy
        // flag may not have been updated for optimization purposes
        //return this._enabled && this._enabledInHierarchy;
    },

    set: function (enabled) {
        //if (this._enabled !== enabled) {
        //    this._enabled = enabled;
        //
        //    if (!this._parent || this._parent.enabled)
        //        this._notifyHierarchyStateChanged(this, enabled);
        //}
    }
});

/**
 * @readonly
 * @name pc.GraphNode#parent
 * @type {pc.GraphNode}
 * @description A read-only property to get a parent graph node.
 */
Object.defineProperty(GraphNode.prototype, 'parent', {
    get: function () {
        //return this._parent;
    }
});

/**
 * @readonly
 * @name pc.GraphNode#path
 * @type {string}
 * @description A read-only property to get the path of the graph node relative to
 * the root of the hierarchy.
 */
Object.defineProperty(GraphNode.prototype, 'path', {
    get: function () {
        //var parent = this._parent;
        //if (parent) {
        //    var path = this.name;
        //
        //    while (parent && parent._parent) {
        //        path = parent.name + "/" + path;
        //        parent = parent._parent;
        //    }
        //
        //    return path;
        //}
        //return '';
    }
});

/**
 * @readonly
 * @name pc.GraphNode#root
 * @type {pc.GraphNode}
 * @description A read-only property to get highest graph node from current node.
 */
Object.defineProperty(GraphNode.prototype, 'root', {
    get: function () {
        //var parent = this._parent;
        //if (!parent)
        //    return this;
        //
        //while (parent._parent)
        //    parent = parent._parent;
        //
        //return parent;
    }
});

/**
 * @readonly
 * @name pc.GraphNode#children
 * @type {pc.GraphNode[]}
 * @description A read-only property to get the children of this graph node.
 */
Object.defineProperty(GraphNode.prototype, 'children', {
    get: function () {
        //return this._children;
    }
});

/**
 * @readonly
 * @name pc.GraphNode#graphDepth
 * @type {number}
 * @description A read-only property to get the depth of this child within the graph. Note that for performance reasons this is only recalculated when a node is added to a new parent, i.e. It is not recalculated when a node is simply removed from the graph.
 */
Object.defineProperty(GraphNode.prototype, 'graphDepth', {
    get: function () {
        //return this._graphDepth;
    }
});

Object.assign(GraphNode.prototype, {
    _notifyHierarchyStateChanged: function (node, enabled) {
        //node._onHierarchyStateChanged(enabled);
        //
        //var c = node._children;
        //for (var i = 0, len = c.length; i < len; i++) {
        //    if (c[i]._enabled)
        //        this._notifyHierarchyStateChanged(c[i], enabled);
        //}
    },

    /**
     * @private
     * @function
     * @name pc.GraphNode#_onHierarchyStateChanged
     * @description Called when the enabled flag of the entity or one of its parents changes.
     * @param {boolean} enabled - True if enabled in the hierarchy, false if disabled.
     */
    _onHierarchyStateChanged: function (enabled) {
        //// Override in derived classes
        //this._enabledInHierarchy = enabled;
        //if (enabled && !this._frozen)
        //    this._unfreezeParentToRoot();
    },

    _cloneInternal: function (clone) {
        //clone.name = this.name;
        //
        //var tags = this.tags._list;
        //for (var i = 0; i < tags.length; i++)
        //    clone.tags.add(tags[i]);
        //
        //clone._labels = Object.assign({}, this._labels);
        //
        //clone.localPosition.copy(this.localPosition);
        //clone.localRotation.copy(this.localRotation);
        //clone.localScale.copy(this.localScale);
        //clone.localEulerAngles.copy(this.localEulerAngles);
        //
        //clone.position.copy(this.position);
        //clone.rotation.copy(this.rotation);
        //clone.eulerAngles.copy(this.eulerAngles);
        //
        //clone.localTransform.copy(this.localTransform);
        //clone._dirtyLocal = this._dirtyLocal;
        //
        //clone.worldTransform.copy(this.worldTransform);
        //clone._dirtyWorld = this._dirtyWorld;
        //clone._dirtyNormal = this._dirtyNormal;
        //clone._aabbVer = this._aabbVer + 1;
        //
        //clone._enabled = this._enabled;
        //
        //clone.scaleCompensation = this.scaleCompensation;
        //
        //// false as this node is not in the hierarchy yet
        //clone._enabledInHierarchy = false;
    },

    clone: function () {
        //var clone = new GraphNode();
        //this._cloneInternal(clone);
        //return clone;
    },

    /**
     * @function
     * @name pc.GraphNode#find
     * @description Search the graph node and all of its descendants for the nodes that satisfy some search criteria.
     * @param {pc.callbacks.FindNode|string} attr - This can either be a function or a string. If it's a function, it is executed
     * for each descendant node to test if node satisfies the search logic. Returning true from the function will
     * include the node into the results. If it's a string then it represents the name of a field or a method of the
     * node. If this is the name of a field then the value passed as the second argument will be checked for equality.
     * If this is the name of a function then the return value of the function will be checked for equality against
     * the valued passed as the second argument to this function.
     * @param {object} [value] - If the first argument (attr) is a property name then this value will be checked against
     * the value of the property.
     * @returns {pc.GraphNode[]} The array of graph nodes that match the search criteria.
     * @example
     * // Finds all nodes that have a model component and have `door` in their lower-cased name
     * var doors = house.find(function (node) {
     *     return node.model && node.name.toLowerCase().indexOf('door') !== -1;
     * });
     * @example
     * // Finds all nodes that have the name property set to 'Test'
     * var entities = parent.find('name', 'Test');
     */
    find: function (attr, value) {
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
    },

    /**
     * @function
     * @name pc.GraphNode#findOne
     * @description Search the graph node and all of its descendants for the first node that satisfies some search criteria.
     * @param {pc.callbacks.FindNode|string} attr - This can either be a function or a string. If it's a function, it is executed
     * for each descendant node to test if node satisfies the search logic. Returning true from the function will
     * result in that node being returned from findOne. If it's a string then it represents the name of a field or a method of the
     * node. If this is the name of a field then the value passed as the second argument will be checked for equality.
     * If this is the name of a function then the return value of the function will be checked for equality against
     * the valued passed as the second argument to this function.
     * @param {object} [value] - If the first argument (attr) is a property name then this value will be checked against
     * the value of the property.
     * @returns {pc.GraphNode} A graph node that match the search criteria.
     * @example
     * // Find the first node that is called `head` and has a model component
     * var head = player.findOne(function (node) {
     *     return node.model && node.name === 'head';
     * });
     * @example
     * // Finds the first node that has the name property set to 'Test'
     * var node = parent.findOne('name', 'Test');
     */
    findOne: function (attr, value) {
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
    },

    /**
     * @function
     * @name pc.GraphNode#findByTag
     * @description Return all graph nodes that satisfy the search query.
     * Query can be simply a string, or comma separated strings,
     * to have inclusive results of assets that match at least one query.
     * A query that consists of an array of tags can be used to match graph nodes that have each tag of array.
     * @param {string|string[]} query - Name of a tag or array of tags.
     * @returns {pc.GraphNode[]} A list of all graph nodes that match the query.
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
    findByTag: function () {
        var tags = this.tags._processArguments(arguments);
        return this._findByTag(tags);
    },

    _findByTag: function (tags) {
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
    },

    /**
     * @function
     * @name pc.GraphNode#findByName
     * @description Get the first node found in the graph with the name. The search
     * is depth first.
     * @param {string} name - The name of the graph.
     * @returns {pc.GraphNode} The first node to be found matching the supplied name.
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
     * @name pc.GraphNode#findByPath
     * @description Get the first node found in the graph by its full path in the graph.
     * The full path has this form 'parent/child/sub-child'. The search is depth first.
     * @param {string} path - The full path of the pc.GraphNode.
     * @returns {pc.GraphNode} The first node to be found matching the supplied path.
     * @example
     * var path = this.entity.findByPath('child/another_child');
     */
    findByPath: function (path) {
        // split the paths in parts. Each part represents a deeper hierarchy level
        var parts = path.split('/');
        var currentParent = this;
        var result = null;

        for (var i = 0, imax = parts.length; i < imax && currentParent; i++) {
            var part = parts[i];

            result = null;

            // check all the children
            var children = currentParent._children;
            for (var j = 0, jmax = children.length; j < jmax; j++) {
                if (children[j].name == part) {
                    result = children[j];
                    break;
                }
            }

            // keep going deeper in the hierarchy
            currentParent = result;
        }

        return result;
    },

    /**
     * @function
     * @name pc.GraphNode#forEach
     * @description Executes a provided function once on this graph node and all of its descendants.
     * @param {pc.callbacks.ForEach} callback - The function to execute on the graph node and each descendant.
     * @param {object} [thisArg] - Optional value to use as this when executing callback function.
     * @example
     * // Log the path and name of each node in descendant tree starting with "parent"
     * parent.forEach(function (node) {
     *     console.log(node.path + "/" + node.name);
     * });
     */
    forEach: function (callback, thisArg) {
        callback.call(thisArg, this);

        var children = this._children;
        for (var i = 0; i < children.length; i++) {
            children[i].forEach(callback, thisArg);
        }
    },

    /**
     * @function
     * @name pc.GraphNode#isDescendantOf
     * @description Check if node is descendant of another node.
     * @param {pc.GraphNode} node - Potential ancestor of node.
     * @returns {boolean} If node is descendant of another node.
     * @example
     * if (roof.isDescendantOf(house)) {
     *     // roof is descendant of house entity
     * }
     */
    isDescendantOf: function (node) {
        //var parent = this._parent;
        //while (parent) {
        //    if (parent === node)
        //        return true;
        //
        //    parent = parent._parent;
        //}
        //return false;
    },

    /**
     * @function
     * @name pc.GraphNode#isAncestorOf
     * @description Check if node is ancestor for another node.
     * @param {pc.GraphNode} node - Potential descendant of node.
     * @returns {boolean} If node is ancestor for another node.
     * @example
     * if (body.isAncestorOf(foot)) {
     *     // foot is within body's hierarchy
     * }
     */
    isAncestorOf: function (node) {
        //return node.isDescendantOf(this);
    },

    /**
     * @function
     * @name pc.GraphNode#getEulerAngles
     * @description Get the world space rotation for the specified GraphNode in Euler angle
     * form. The order of the returned Euler angles is XYZ. The value returned by this function
     * should be considered read-only. In order to set the world-space rotation of the graph
     * node, use {@link pc.GraphNode#setEulerAngles}.
     * @returns {pc.Vec3} The world space rotation of the graph node in Euler angle form.
     * @example
     * var angles = this.entity.getEulerAngles(); // [0,0,0]
     * angles[1] = 180; // rotate the entity around Y by 180 degrees
     * this.entity.setEulerAngles(angles);
     */
    getEulerAngles: function () {
        //this.getWorldTransform().getEulerAngles(this.eulerAngles);
        //return this.eulerAngles;
    },

    /**
     * @function
     * @name pc.GraphNode#getLocalEulerAngles
     * @description Get the rotation in local space for the specified GraphNode. The rotation
     * is returned as euler angles in a 3-dimensional vector where the order is XYZ. The
     * returned vector should be considered read-only. To update the local rotation, use
     * {@link pc.GraphNode#setLocalEulerAngles}.
     * @returns {pc.Vec3} The local space rotation of the graph node as euler angles in XYZ order.
     * @example
     * var angles = this.entity.getLocalEulerAngles();
     * angles[1] = 180;
     * this.entity.setLocalEulerAngles(angles);
     */
    getLocalEulerAngles: function () {
        //this.localRotation.getEulerAngles(this.localEulerAngles);
        //return this.localEulerAngles;
    },

    /**
     * @function
     * @name pc.GraphNode#getLocalPosition
     * @description Get the position in local space for the specified GraphNode. The position
     * is returned as a 3-dimensional vector. The returned vector should be considered read-only.
     * To update the local position, use {@link pc.GraphNode#setLocalPosition}.
     * @returns {pc.Vec3} The local space position of the graph node.
     * @example
     * var position = this.entity.getLocalPosition();
     * position[0] += 1; // move the entity 1 unit along x.
     * this.entity.setLocalPosition(position);
     */
    getLocalPosition: function () {
        //return this.localPosition;
    },

    /**
     * @function
     * @name pc.GraphNode#getLocalRotation
     * @description Get the rotation in local space for the specified GraphNode. The rotation
     * is returned as a quaternion. The returned quaternion should be considered read-only.
     * To update the local rotation, use {@link pc.GraphNode#setLocalRotation}.
     * @returns {pc.Quat} The local space rotation of the graph node as a quaternion.
     * @example
     * var rotation = this.entity.getLocalRotation();
     */
    getLocalRotation: function () {
        //return this.localRotation;
    },

    /**
     * @function
     * @name pc.GraphNode#getLocalScale
     * @description Get the scale in local space for the specified GraphNode. The scale
     * is returned as a 3-dimensional vector. The returned vector should be considered read-only.
     * To update the local scale, use {@link pc.GraphNode#setLocalScale}.
     * @returns {pc.Vec3} The local space scale of the graph node.
     * @example
     * var scale = this.entity.getLocalScale();
     * scale.x = 100;
     * this.entity.setLocalScale(scale);
     */
    getLocalScale: function () {
        //return this.localScale;
    },

    /**
     * @function
     * @name pc.GraphNode#getLocalTransform
     * @description Get the local transform matrix for this graph node. This matrix
     * is the transform relative to the node's parent's world transformation matrix.
     * @returns {pc.Mat4} The node's local transformation matrix.
     * @example
     * var transform = this.entity.getLocalTransform();
     */
    getLocalTransform: function () {
        //if (this._dirtyLocal) {
        //    this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);
        //    this._dirtyLocal = false;
        //}
        //return this.localTransform;
    },

    /**
     * @function
     * @name pc.GraphNode#getPosition
     * @description Get the world space position for the specified GraphNode. The
     * value returned by this function should be considered read-only. In order to set
     * the world-space position of the graph node, use {@link pc.GraphNode#setPosition}.
     * @returns {pc.Vec3} The world space position of the graph node.
     * @example
     * var position = this.entity.getPosition();
     * position.x = 10;
     * this.entity.setPosition(position);
     */
    getPosition: function () {
        //this.getWorldTransform().getTranslation(this.position);
        //return this.position;
    },

    /**
     * @function
     * @name pc.GraphNode#getRotation
     * @description Get the world space rotation for the specified GraphNode in quaternion
     * form. The value returned by this function should be considered read-only. In order
     * to set the world-space rotation of the graph node, use {@link pc.GraphNode#setRotation}.
     * @returns {pc.Quat} The world space rotation of the graph node as a quaternion.
     * @example
     * var rotation = this.entity.getRotation();
     */
    getRotation: function () {
        //this.rotation.setFromMat4(this.getWorldTransform());
        //return this.rotation;
    },

    /**
     * @private
     * @function
     * @name pc.GraphNode#getScale
     * @description Get the world space scale for the specified GraphNode. The returned value
     * will only be correct for graph nodes that have a non-skewed world transform (a skew can
     * be introduced by the compounding of rotations and scales higher in the graph node
     * hierarchy). The value returned by this function should be considered read-only. Note
     * that it is not possible to set the world space scale of a graph node directly.
     * @returns {pc.Vec3} The world space scale of the graph node.
     * @example
     * var scale = this.entity.getScale();
     */
    getScale: function () {
        //if (!this._scale) {
        //    this._scale = new Vec3();
        //}
        //return this.getWorldTransform().getScale(this._scale);
    },

    /**
     * @function
     * @name pc.GraphNode#getWorldTransform
     * @description Get the world transformation matrix for this graph node.
     * @returns {pc.Mat4} The node's world transformation matrix.
     * @example
     * var transform = this.entity.getWorldTransform();
     */
    getWorldTransform: function () {
        //if (!this._dirtyLocal && !this._dirtyWorld)
        //    return this.worldTransform;
        //
        //if (this._parent)
        //    this._parent.getWorldTransform();
        //
        //this._sync();
        //
        //return this.worldTransform;
    },

    /**
     * @function
     * @name pc.GraphNode#reparent
     * @description Remove graph node from current parent and add as child to new parent.
     * @param {pc.GraphNode} parent - New parent to attach graph node to.
     * @param {number} [index] - The child index where the child node should be placed.
     */
    reparent: function (parent, index) {
        //var current = this._parent;
        //
        //if (current)
        //    current.removeChild(this);
        //
        //if (parent) {
        //    if (index >= 0) {
        //        parent.insertChild(this, index);
        //    } else {
        //        parent.addChild(this);
        //    }
        //}
    },

    /**
     * @function
     * @name pc.GraphNode#setLocalEulerAngles
     * @description Sets the local-space rotation of the specified graph node using euler angles.
     * Eulers are interpreted in XYZ order. Eulers must be specified in degrees. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * local-space euler rotation.
     * @param {pc.Vec3|number} x - 3-dimensional vector holding eulers or rotation around local-space
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
    setLocalEulerAngles: function (x, y, z) {
        //if (x instanceof Vec3) {
        //    this.localRotation.setFromEulerAngles(x.x, x.y, x.z);
        //} else {
        //    this.localRotation.setFromEulerAngles(x, y, z);
        //}
        //
        //if (!this._dirtyLocal)
        //    this._dirtifyLocal();
    },

    /**
     * @function
     * @name pc.GraphNode#setLocalPosition
     * @description Sets the local-space position of the specified graph node. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * local-space position.
     * @param {pc.Vec3|number} x - 3-dimensional vector holding local-space position or
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
    setLocalPosition: function (x, y, z) {
        //if (x instanceof Vec3) {
        //    this.localPosition.copy(x);
        //} else {
        //    this.localPosition.set(x, y, z);
        //}
        //
        //if (!this._dirtyLocal)
        //    this._dirtifyLocal();
    },

    /**
     * @function
     * @name pc.GraphNode#setLocalRotation
     * @description Sets the local-space rotation of the specified graph node. This function
     * has two valid signatures: you can either pass a quaternion or 3 numbers to specify the
     * local-space rotation.
     * @param {pc.Quat|number} x - Quaternion holding local-space rotation or x-component of
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
    setLocalRotation: function (x, y, z, w) {
        //if (x instanceof Quat) {
        //    this.localRotation.copy(x);
        //} else {
        //    this.localRotation.set(x, y, z, w);
        //}
        //
        //if (!this._dirtyLocal)
        //    this._dirtifyLocal();
    },

    /**
     * @function
     * @name pc.GraphNode#setLocalScale
     * @description Sets the local-space scale factor of the specified graph node. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * local-space scale.
     * @param {pc.Vec3|number} x - 3-dimensional vector holding local-space scale or x-coordinate
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
    setLocalScale: function (x, y, z) {
        //if (x instanceof Vec3) {
        //    this.localScale.copy(x);
        //} else {
        //    this.localScale.set(x, y, z);
        //}
        //
        //if (!this._dirtyLocal)
        //    this._dirtifyLocal();
    },

    _dirtifyLocal: function () {
        //if (!this._dirtyLocal) {
        //    this._dirtyLocal = true;
        //    if (!this._dirtyWorld)
        //        this._dirtifyWorld();
        //}
    },

    _unfreezeParentToRoot: function () {
        //var p = this._parent;
        //while (p) {
        //    p._frozen = false;
        //    p = p._parent;
        //}
    },

    _dirtifyWorld: function () {
        //if (!this._dirtyWorld)
        //    this._unfreezeParentToRoot();
        //this._dirtifyWorldInternal();
    },

    _dirtifyWorldInternal: function () {
        //if (!this._dirtyWorld) {
        //    this._frozen = false;
        //    this._dirtyWorld = true;
        //    for (var i = 0; i < this._children.length; i++) {
        //        if (!this._children[i]._dirtyWorld)
        //            this._children[i]._dirtifyWorldInternal();
        //    }
        //}
        //this._dirtyNormal = true;
        //this._aabbVer++;
    },

    /**
     * @function
     * @name pc.GraphNode#setPosition
     * @description Sets the world-space position of the specified graph node. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * world-space position.
     * @param {pc.Vec3|number} x - 3-dimensional vector holding world-space position or
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
    setPosition: function () {
        //var position = new Vec3();
        //var invParentWtm = new Mat4();
        //
        //return function (x, y, z) {
        //    if (x instanceof Vec3) {
        //        position.copy(x);
        //    } else {
        //        position.set(x, y, z);
        //    }
        //
        //    if (this._parent === null) {
        //        this.localPosition.copy(position);
        //    } else {
        //        invParentWtm.copy(this._parent.getWorldTransform()).invert();
        //        invParentWtm.transformPoint(position, this.localPosition);
        //    }
        //
        //    if (!this._dirtyLocal)
        //        this._dirtifyLocal();
        //};
    //}(),
    },

    /**
     * @function
     * @name pc.GraphNode#setRotation
     * @description Sets the world-space rotation of the specified graph node. This function
     * has two valid signatures: you can either pass a quaternion or 3 numbers to specify the
     * world-space rotation.
     * @param {pc.Quat|number} x - Quaternion holding world-space rotation or x-component of
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
    setRotation: function () {
        //var rotation = new Quat();
        //var invParentRot = new Quat();
        //
        //return function (x, y, z, w) {
        //    if (x instanceof Quat) {
        //        rotation.copy(x);
        //    } else {
        //        rotation.set(x, y, z, w);
        //    }
        //
        //    if (this._parent === null) {
        //        this.localRotation.copy(rotation);
        //    } else {
        //        var parentRot = this._parent.getRotation();
        //        invParentRot.copy(parentRot).invert();
        //        this.localRotation.copy(invParentRot).mul(rotation);
        //    }
        //
        //    if (!this._dirtyLocal)
        //        this._dirtifyLocal();
        //};
    },//(),

    /**
     * @function
     * @name pc.GraphNode#setEulerAngles
     * @description Sets the world-space rotation of the specified graph node using euler angles.
     * Eulers are interpreted in XYZ order. Eulers must be specified in degrees. This function
     * has two valid signatures: you can either pass a 3D vector or 3 numbers to specify the
     * world-space euler rotation.
     * @param {pc.Vec3|number} x - 3-dimensional vector holding eulers or rotation around world-space
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
    setEulerAngles: function () {
        //var invParentRot = new Quat();
        //
        //return function (x, y, z) {
        //    if (x instanceof Vec3) {
        //        this.localRotation.setFromEulerAngles(x.x, x.y, x.z);
        //    } else {
        //        this.localRotation.setFromEulerAngles(x, y, z);
        //    }
        //
        //    if (this._parent !== null) {
        //        var parentRot = this._parent.getRotation();
        //        invParentRot.copy(parentRot).invert();
        //        this.localRotation.mul2(invParentRot, this.localRotation);
        //    }
        //
        //    if (!this._dirtyLocal)
        //        this._dirtifyLocal();
        //};
    },//(),

    /**
     * @function
     * @name pc.GraphNode#addChild
     * @description Add a new child to the child list and update the parent value of the child node.
     * @param {pc.GraphNode} node - The new child to add.
     * @example
     * var e = new pc.Entity(app);
     * this.entity.addChild(e);
     */
    addChild: function (node) {
        //if (node._parent !== null)
        //    throw new Error("GraphNode is already parented");
        //
        //// #ifdef DEBUG
        //this._debugInsertChild(node);
        //// #endif
        //
        //this._children.push(node);
        //this._onInsertChild(node);
    },

    addChildAndSaveTransform: function (node) {
        //// #ifdef DEBUG
        //this._debugInsertChild(node);
        //// #endif
        //
        //var wPos = node.getPosition();
        //var wRot = node.getRotation();
        //
        //var current = node._parent;
        //if (current)
        //    current.removeChild(node);
        //
        //node.setPosition(tmpMat4.copy(this.worldTransform).invert().transformPoint(wPos));
        //node.setRotation(tmpQuat.copy(this.getRotation()).invert().mul(wRot));
        //
        //this._children.push(node);
        //this._onInsertChild(node);
    },

    /**
     * @function
     * @name pc.GraphNode#insertChild
     * @description Insert a new child to the child list at the specified index and update the parent value of the child node.
     * @param {pc.GraphNode} node - The new child to insert.
     * @param {number} index - The index in the child list of the parent where the new node will be inserted.
     * @example
     * var e = new pc.Entity(app);
     * this.entity.insertChild(e, 1);
     */
    insertChild: function (node, index) {
        //if (node._parent !== null)
        //    throw new Error("GraphNode is already parented");
        //
        //// #ifdef DEBUG
        //this._debugInsertChild(node);
        //// #endif
        //
        //this._children.splice(index, 0, node);
        //this._onInsertChild(node);
    },

    // #ifdef DEBUG
    _debugInsertChild: function (node) {
        //if (this === node)
        //    throw new Error("GraphNode cannot be a child of itself");
        //
        //if (this.isDescendantOf(node))
        //    throw new Error("GraphNode cannot add an ancestor as a child");
    },
    // #endif

    _onInsertChild: function (node) {
        //node._parent = this;
        //
        //// the child node should be enabled in the hierarchy only if itself is enabled and if
        //// this parent is enabled
        //var enabledInHierarchy = (node._enabled && this.enabled);
        //if (node._enabledInHierarchy !== enabledInHierarchy) {
        //    node._enabledInHierarchy = enabledInHierarchy;
        //
        //    // propagate the change to the children - necessary if we reparent a node
        //    // under a parent with a different enabled state (if we reparent a node that is
        //    // not active in the hierarchy under a parent who is active in the hierarchy then
        //    // we want our node to be activated)
        //    node._notifyHierarchyStateChanged(node, enabledInHierarchy);
        //}
        //
        //// The graph depth of the child and all of its descendants will now change
        //node._updateGraphDepth();
        //
        //// The child (plus subhierarchy) will need world transforms to be recalculated
        //node._dirtifyWorld();
        //// node might be already marked as dirty, in that case the whole chain stays frozen, so let's enforce unfreeze
        //if (this._frozen)
        //    node._unfreezeParentToRoot();
        //
        //// alert an entity that it has been inserted
        //if (node.fire) node.fire('insert', this);
        //
        //// alert the parent that it has had a child inserted
        //if (this.fire) this.fire('childinsert', node);
    },

    _updateGraphDepth: function () {
        //if (this._parent) {
        //    this._graphDepth = this._parent._graphDepth + 1;
        //} else {
        //    this._graphDepth = 0;
        //}
        //
        //for (var i = 0, len = this._children.length; i < len; i++) {
        //    this._children[i]._updateGraphDepth();
        //}
    },

    /**
     * @function
     * @name pc.GraphNode#removeChild
     * @description Remove the node from the child list and update the parent value of the child.
     * @param {pc.GraphNode} child - The node to remove.
     * @example
     * var child = this.entity.children[0];
     * this.entity.removeChild(child);
     */
    removeChild: function (child) {
        //var i;
        //var length = this._children.length;
        //
        //// Remove from child list
        //for (i = 0; i < length; ++i) {
        //    if (this._children[i] === child) {
        //        this._children.splice(i, 1);
        //
        //        // Clear parent
        //        child._parent = null;
        //
        //        // alert child that it has been removed
        //        if (child.fire) child.fire('remove', this);
        //
        //        // alert the parent that it has had a child removed
        //        if (this.fire) this.fire('childremove', child);
        //
        //        return;
        //    }
        //}
    },

    _sync: function () {
        //if (this._dirtyLocal) {
        //    this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);
        //
        //    this._dirtyLocal = false;
        //}
        //
        //if (this._dirtyWorld) {
        //    if (this._parent === null) {
        //        this.worldTransform.copy(this.localTransform);
        //    } else {
        //        if (this.scaleCompensation) {
        //            var parentWorldScale;
        //            var parent = this._parent;
        //
        //            // Find a parent of the first uncompensated node up in the hierarchy and use its scale * localScale
        //            var scale = this.localScale;
        //            var parentToUseScaleFrom = parent; // current parent
        //            if (parentToUseScaleFrom) {
        //                while (parentToUseScaleFrom && parentToUseScaleFrom.scaleCompensation) {
        //                    parentToUseScaleFrom = parentToUseScaleFrom._parent;
        //                }
        //                // topmost node with scale compensation
        //                if (parentToUseScaleFrom) {
        //                    parentToUseScaleFrom = parentToUseScaleFrom._parent; // node without scale compensation
        //                    if (parentToUseScaleFrom) {
        //                        parentWorldScale = parentToUseScaleFrom.worldTransform.getScale();
        //                        scaleCompensateScale.mul2(parentWorldScale, this.localScale);
        //                        scale = scaleCompensateScale;
        //                    }
        //                }
        //            }
        //
        //            // Rotation is as usual
        //            scaleCompensateRot2.setFromMat4(parent.worldTransform);
        //            scaleCompensateRot.mul2(scaleCompensateRot2, this.localRotation);
        //
        //            // Find matrix to transform position
        //            var tmatrix = parent.worldTransform;
        //            if (parent.scaleCompensation) {
        //                scaleCompensateScaleForParent.mul2(parentWorldScale, parent.getLocalScale());
        //                scaleCompensatePosTransform.setTRS(parent.worldTransform.getTranslation(scaleCompensatePos),
        //                                                   scaleCompensateRot2,
        //                                                   scaleCompensateScaleForParent);
        //                tmatrix = scaleCompensatePosTransform;
        //            }
        //            tmatrix.transformPoint(this.localPosition, scaleCompensatePos);
        //
        //            this.worldTransform.setTRS(scaleCompensatePos, scaleCompensateRot, scale);
        //
        //        } else {
        //            this.worldTransform.mulAffine2(this._parent.worldTransform, this.localTransform);
        //        }
        //    }
        //
        //    this._dirtyWorld = false;
        //}
    },

    /**
     * @private
     * @function
     * @name pc.GraphNode#syncHierarchy
     * @description Updates the world transformation matrices at this node and all of its descendants.
     */
    syncHierarchy: function () {
        //if (!this._enabled)
        //    return;
        //
        //if (this._frozen)
        //    return;
        //this._frozen = true;
        //
        //if (this._dirtyLocal || this._dirtyWorld) {
        //    this._sync();
        //}
        //
        //var children = this._children;
        //for (var i = 0, len = children.length; i < len; i++) {
        //    children[i].syncHierarchy();
        //}
    },

    /**
     * @function
     * @name pc.GraphNode#lookAt
     * @description Reorients the graph node so that the negative z-axis points towards the target.
     * This function has two valid signatures. Either pass 3D vectors for the look at coordinate and up
     * vector, or pass numbers to represent the vectors.
     * @param {pc.Vec3|number} x - If passing a 3D vector, this is the world-space coordinate to look at.
     * Otherwise, it is the x-component of the world-space coordinate to look at.
     * @param {pc.Vec3|number} [y] - If passing a 3D vector, this is the world-space up vector for look at
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
    lookAt: function () {
        //var matrix = new Mat4();
        //var target = new Vec3();
        //var up = new Vec3();
        //var rotation = new Quat();
        //
        //return function (tx, ty, tz, ux, uy, uz) {
        //    if (tx instanceof Vec3) {
        //        target.copy(tx);
        //
        //        if (ty instanceof Vec3) { // vec3, vec3
        //            up.copy(ty);
        //        } else { // vec3
        //            up.copy(Vec3.UP);
        //        }
        //    } else if (tz === undefined) {
        //        return;
        //    } else {
        //        target.set(tx, ty, tz);
        //
        //        if (ux !== undefined) { // number, number, number, number, number, number
        //            up.set(ux, uy, uz);
        //        } else { // number, number, number
        //            up.copy(Vec3.UP);
        //        }
        //    }
        //
        //    matrix.setLookAt(this.getPosition(), target, up);
        //    rotation.setFromMat4(matrix);
        //    this.setRotation(rotation);
        //};
    },//(),

    /**
     * @function
     * @name pc.GraphNode#translate
     * @description Translates the graph node in world-space by the specified translation vector.
     * This function has two valid signatures: you can either pass a 3D vector or 3 numbers to
     * specify the world-space translation.
     * @param {pc.Vec3|number} x - 3-dimensional vector holding world-space translation or
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
    translate: function () {
        //var translation = new Vec3();
        //
        //return function (x, y, z) {
        //    if (x instanceof Vec3) {
        //        translation.copy(x);
        //    } else {
        //        translation.set(x, y, z);
        //    }
        //
        //    translation.add(this.getPosition());
        //    this.setPosition(translation);
        //};
    },//(),

    /**
     * @function
     * @name pc.GraphNode#translateLocal
     * @description Translates the graph node in local-space by the specified translation vector.
     * This function has two valid signatures: you can either pass a 3D vector or 3 numbers to
     * specify the local-space translation.
     * @param {pc.Vec3|number} x - 3-dimensional vector holding local-space translation or
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
    translateLocal: function () {
        //var translation = new Vec3();
        //
        //return function (x, y, z) {
        //    if (x instanceof Vec3) {
        //        translation.copy(x);
        //    } else {
        //        translation.set(x, y, z);
        //    }
        //
        //    this.localRotation.transformVector(translation, translation);
        //    this.localPosition.add(translation);
        //
        //    if (!this._dirtyLocal)
        //        this._dirtifyLocal();
        //};
    },//(),

    /**
     * @function
     * @name pc.GraphNode#rotate
     * @description Rotates the graph node in world-space by the specified Euler angles.
     * Eulers are specified in degrees in XYZ order. This function has two valid signatures:
     * you can either pass a 3D vector or 3 numbers to specify the world-space rotation.
     * @param {pc.Vec3|number} x - 3-dimensional vector holding world-space rotation or
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
    rotate: function () {
        //var quaternion = new Quat();
        //var invParentRot = new Quat();
        //
        //return function (x, y, z) {
        //    if (x instanceof Vec3) {
        //        quaternion.setFromEulerAngles(x.x, x.y, x.z);
        //    } else {
        //        quaternion.setFromEulerAngles(x, y, z);
        //    }
        //
        //    if (this._parent === null) {
        //        this.localRotation.mul2(quaternion, this.localRotation);
        //    } else {
        //        var rot = this.getRotation();
        //        var parentRot = this._parent.getRotation();
        //
        //        invParentRot.copy(parentRot).invert();
        //        quaternion.mul2(invParentRot, quaternion);
        //        this.localRotation.mul2(quaternion, rot);
        //    }
        //
        //    if (!this._dirtyLocal)
        //        this._dirtifyLocal();
        //};
    },//(),

    /**
     * @function
     * @name pc.GraphNode#rotateLocal
     * @description Rotates the graph node in local-space by the specified Euler angles.
     * Eulers are specified in degrees in XYZ order. This function has two valid signatures:
     * you can either pass a 3D vector or 3 numbers to specify the local-space rotation.
     * @param {pc.Vec3|number} x - 3-dimensional vector holding local-space rotation or
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
    rotateLocal: function () {
        //var quaternion = new Quat();
        //
        //return function (x, y, z) {
        //    if (x instanceof Vec3) {
        //        quaternion.setFromEulerAngles(x.x, x.y, x.z);
        //    } else {
        //        quaternion.setFromEulerAngles(x, y, z);
        //    }
        //
        //    this.localRotation.mul(quaternion);
        //
        //    if (!this._dirtyLocal)
        //        this._dirtifyLocal();
        //};
    }//()
});

export { GraphNode };
