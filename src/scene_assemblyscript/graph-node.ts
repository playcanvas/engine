import { EventHandler } from '../core/event-handler.js';
import { Tags } from '../core/tags.js';
import { Mat4 } from '../math_assemblyscript/mat4.js';
import { Quat } from '../math_assemblyscript/quat.js';
import { Vec3 } from '../math_assemblyscript/vec3.js';
import { Mat3 } from '../math_assemblyscript/mat3.js';

declare var assemblyscript: any;
declare var Loader: any;

/*
text = "";
for (var name in assemblyscript.instance.exports) {
    if (!name.startsWith("GraphNode#"))
        continue;
    var funcname = "$" + name.replace("GraphNode#", "").replace(":", "$").padEnd(40);
    var importname = 
    text += "var ";
    text += funcname;
    text +=" = assemblyscript.instance.exports[\"";
    text += name;
    text += "\"];\n";
}
text;
*/

var $get$name                                 = assemblyscript.instance.exports["GraphNode#get:name"];
var $set$name                                 = assemblyscript.instance.exports["GraphNode#set:name"];
var $get$localPosition                        = assemblyscript.instance.exports["GraphNode#get:localPosition"];
var $set$localPosition                        = assemblyscript.instance.exports["GraphNode#set:localPosition"];
var $get$localRotation                        = assemblyscript.instance.exports["GraphNode#get:localRotation"];
var $set$localRotation                        = assemblyscript.instance.exports["GraphNode#set:localRotation"];
var $get$localScale                           = assemblyscript.instance.exports["GraphNode#get:localScale"];
var $set$localScale                           = assemblyscript.instance.exports["GraphNode#set:localScale"];
var $get$localEulerAngles                     = assemblyscript.instance.exports["GraphNode#get:localEulerAngles"];
var $set$localEulerAngles                     = assemblyscript.instance.exports["GraphNode#set:localEulerAngles"];
var $get$position                             = assemblyscript.instance.exports["GraphNode#get:position"];
var $set$position                             = assemblyscript.instance.exports["GraphNode#set:position"];
var $get$rotation                             = assemblyscript.instance.exports["GraphNode#get:rotation"];
var $set$rotation                             = assemblyscript.instance.exports["GraphNode#set:rotation"];
var $get$eulerAngles                          = assemblyscript.instance.exports["GraphNode#get:eulerAngles"];
var $set$eulerAngles                          = assemblyscript.instance.exports["GraphNode#set:eulerAngles"];
var $get$_scale                               = assemblyscript.instance.exports["GraphNode#get:_scale"];
var $set$_scale                               = assemblyscript.instance.exports["GraphNode#set:_scale"];
var $get$localTransform                       = assemblyscript.instance.exports["GraphNode#get:localTransform"];
var $set$localTransform                       = assemblyscript.instance.exports["GraphNode#set:localTransform"];
var $get$_dirtyLocal                          = assemblyscript.instance.exports["GraphNode#get:_dirtyLocal"];
var $set$_dirtyLocal                          = assemblyscript.instance.exports["GraphNode#set:_dirtyLocal"];
var $get$_aabbVer                             = assemblyscript.instance.exports["GraphNode#get:_aabbVer"];
var $set$_aabbVer                             = assemblyscript.instance.exports["GraphNode#set:_aabbVer"];
var $get$_frozen                              = assemblyscript.instance.exports["GraphNode#get:_frozen"];
var $set$_frozen                              = assemblyscript.instance.exports["GraphNode#set:_frozen"];
var $get$worldTransform                       = assemblyscript.instance.exports["GraphNode#get:worldTransform"];
var $set$worldTransform                       = assemblyscript.instance.exports["GraphNode#set:worldTransform"];
var $get$_dirtyWorld                          = assemblyscript.instance.exports["GraphNode#get:_dirtyWorld"];
var $set$_dirtyWorld                          = assemblyscript.instance.exports["GraphNode#set:_dirtyWorld"];
var $get$normalMatrix                         = assemblyscript.instance.exports["GraphNode#get:normalMatrix"];
var $set$normalMatrix                         = assemblyscript.instance.exports["GraphNode#set:normalMatrix"];
var $get$_dirtyNormal                         = assemblyscript.instance.exports["GraphNode#get:_dirtyNormal"];
var $set$_dirtyNormal                         = assemblyscript.instance.exports["GraphNode#set:_dirtyNormal"];
var $get$_right                               = assemblyscript.instance.exports["GraphNode#get:_right"];
var $set$_right                               = assemblyscript.instance.exports["GraphNode#set:_right"];
var $get$_up                                  = assemblyscript.instance.exports["GraphNode#get:_up"];
var $set$_up                                  = assemblyscript.instance.exports["GraphNode#set:_up"];
var $get$_forward                             = assemblyscript.instance.exports["GraphNode#get:_forward"];
var $set$_forward                             = assemblyscript.instance.exports["GraphNode#set:_forward"];
var $get$_parent                              = assemblyscript.instance.exports["GraphNode#get:_parent"];
var $set$_parent                              = assemblyscript.instance.exports["GraphNode#set:_parent"];
var $get$_children                            = assemblyscript.instance.exports["GraphNode#get:_children"];
var $set$_children                            = assemblyscript.instance.exports["GraphNode#set:_children"];
var $get$_graphDepth                          = assemblyscript.instance.exports["GraphNode#get:_graphDepth"];
var $set$_graphDepth                          = assemblyscript.instance.exports["GraphNode#set:_graphDepth"];
var $get$_enabled                             = assemblyscript.instance.exports["GraphNode#get:_enabled"];
var $set$_enabled                             = assemblyscript.instance.exports["GraphNode#set:_enabled"];
var $get$_enabledInHierarchy                  = assemblyscript.instance.exports["GraphNode#get:_enabledInHierarchy"];
var $set$_enabledInHierarchy                  = assemblyscript.instance.exports["GraphNode#set:_enabledInHierarchy"];
var $get$scaleCompensation                    = assemblyscript.instance.exports["GraphNode#get:scaleCompensation"];
var $set$scaleCompensation                    = assemblyscript.instance.exports["GraphNode#set:scaleCompensation"];
var $constructor                              = assemblyscript.instance.exports["GraphNode#constructor"];
var $get$right                                = assemblyscript.instance.exports["GraphNode#get:right"];
var $get$up                                   = assemblyscript.instance.exports["GraphNode#get:up"];
var $get$forward                              = assemblyscript.instance.exports["GraphNode#get:forward"];
var $get$enabled                              = assemblyscript.instance.exports["GraphNode#get:enabled"];
var $set$enabled                              = assemblyscript.instance.exports["GraphNode#set:enabled"];
var $get$parent                               = assemblyscript.instance.exports["GraphNode#get:parent"];
var $get$path                                 = assemblyscript.instance.exports["GraphNode#get:path"];
var $get$root                                 = assemblyscript.instance.exports["GraphNode#get:root"];
var $get$children                             = assemblyscript.instance.exports["GraphNode#get:children"];
var $get$graphDepth                           = assemblyscript.instance.exports["GraphNode#get:graphDepth"];
var $_notifyHierarchyStateChanged             = assemblyscript.instance.exports["GraphNode#_notifyHierarchyStateChanged"];
var $_onHierarchyStateChanged                 = assemblyscript.instance.exports["GraphNode#_onHierarchyStateChanged"];
var $_cloneInternal                           = assemblyscript.instance.exports["GraphNode#_cloneInternal"];
var $clone                                    = assemblyscript.instance.exports["GraphNode#clone"];
var $isDescendantOf                           = assemblyscript.instance.exports["GraphNode#isDescendantOf"];
var $isAncestorOf                             = assemblyscript.instance.exports["GraphNode#isAncestorOf"];
var $getEulerAngles                           = assemblyscript.instance.exports["GraphNode#getEulerAngles"];
var $getLocalEulerAngles                      = assemblyscript.instance.exports["GraphNode#getLocalEulerAngles"];
var $getLocalPosition                         = assemblyscript.instance.exports["GraphNode#getLocalPosition"];
var $getLocalRotation                         = assemblyscript.instance.exports["GraphNode#getLocalRotation"];
var $getLocalScale                            = assemblyscript.instance.exports["GraphNode#getLocalScale"];
var $getLocalTransform                        = assemblyscript.instance.exports["GraphNode#getLocalTransform"];
var $getPosition                              = assemblyscript.instance.exports["GraphNode#getPosition"];
var $getRotation                              = assemblyscript.instance.exports["GraphNode#getRotation"];
var $getScale                                 = assemblyscript.instance.exports["GraphNode#getScale"];
var $getWorldTransform                        = assemblyscript.instance.exports["GraphNode#getWorldTransform"];
var $reparent                                 = assemblyscript.instance.exports["GraphNode#reparent"];
var $setLocalEulerAngles                      = assemblyscript.instance.exports["GraphNode#setLocalEulerAngles"];
var $setLocalPosition                         = assemblyscript.instance.exports["GraphNode#setLocalPosition"];
var $setLocalRotation                         = assemblyscript.instance.exports["GraphNode#setLocalRotation"];
var $setLocalScale                            = assemblyscript.instance.exports["GraphNode#setLocalScale"];
var $_dirtifyLocal                            = assemblyscript.instance.exports["GraphNode#_dirtifyLocal"];
var $_unfreezeParentToRoot                    = assemblyscript.instance.exports["GraphNode#_unfreezeParentToRoot"];
var $_dirtifyWorld                            = assemblyscript.instance.exports["GraphNode#_dirtifyWorld"];
var $_dirtifyWorldInternal                    = assemblyscript.instance.exports["GraphNode#_dirtifyWorldInternal"];
var $get$setPosition_position                 = assemblyscript.instance.exports["GraphNode#get:setPosition_position"];
var $set$setPosition_position                 = assemblyscript.instance.exports["GraphNode#set:setPosition_position"];
var $get$setPosition_invParentWtm             = assemblyscript.instance.exports["GraphNode#get:setPosition_invParentWtm"];
var $set$setPosition_invParentWtm             = assemblyscript.instance.exports["GraphNode#set:setPosition_invParentWtm"];
var $setPosition                              = assemblyscript.instance.exports["GraphNode#setPosition"];
var $get$setRotation_rotation                 = assemblyscript.instance.exports["GraphNode#get:setRotation_rotation"];
var $set$setRotation_rotation                 = assemblyscript.instance.exports["GraphNode#set:setRotation_rotation"];
var $get$setRotation_invParentRot             = assemblyscript.instance.exports["GraphNode#get:setRotation_invParentRot"];
var $set$setRotation_invParentRot             = assemblyscript.instance.exports["GraphNode#set:setRotation_invParentRot"];
var $setRotation                              = assemblyscript.instance.exports["GraphNode#setRotation"];
var $get$setEulerAngles_invParentRot          = assemblyscript.instance.exports["GraphNode#get:setEulerAngles_invParentRot"];
var $set$setEulerAngles_invParentRot          = assemblyscript.instance.exports["GraphNode#set:setEulerAngles_invParentRot"];
var $setEulerAngles                           = assemblyscript.instance.exports["GraphNode#setEulerAngles"];
var $addChild                                 = assemblyscript.instance.exports["GraphNode#addChild"];
var $insertChild                              = assemblyscript.instance.exports["GraphNode#insertChild"];
var $_debugInsertChild                        = assemblyscript.instance.exports["GraphNode#_debugInsertChild"];
var $_onInsertChild                           = assemblyscript.instance.exports["GraphNode#_onInsertChild"];
var $_updateGraphDepth                        = assemblyscript.instance.exports["GraphNode#_updateGraphDepth"];
var $removeChild                              = assemblyscript.instance.exports["GraphNode#removeChild"];
var $get$_sync_scale                          = assemblyscript.instance.exports["GraphNode#get:_sync_scale"];
var $set$_sync_scale                          = assemblyscript.instance.exports["GraphNode#set:_sync_scale"];
var $_sync                                    = assemblyscript.instance.exports["GraphNode#_sync"];
var $syncHierarchy                            = assemblyscript.instance.exports["GraphNode#syncHierarchy"];
var $get$lookAt_matrix                        = assemblyscript.instance.exports["GraphNode#get:lookAt_matrix"];
var $set$lookAt_matrix                        = assemblyscript.instance.exports["GraphNode#set:lookAt_matrix"];
var $get$lookAt_target                        = assemblyscript.instance.exports["GraphNode#get:lookAt_target"];
var $set$lookAt_target                        = assemblyscript.instance.exports["GraphNode#set:lookAt_target"];
var $get$lookAt_up                            = assemblyscript.instance.exports["GraphNode#get:lookAt_up"];
var $set$lookAt_up                            = assemblyscript.instance.exports["GraphNode#set:lookAt_up"];
var $get$lookAt_rotation                      = assemblyscript.instance.exports["GraphNode#get:lookAt_rotation"];
var $set$lookAt_rotation                      = assemblyscript.instance.exports["GraphNode#set:lookAt_rotation"];
var $lookAt                                   = assemblyscript.instance.exports["GraphNode#lookAt"];
var $get$translate_translation                = assemblyscript.instance.exports["GraphNode#get:translate_translation"];
var $set$translate_translation                = assemblyscript.instance.exports["GraphNode#set:translate_translation"];
var $translate                                = assemblyscript.instance.exports["GraphNode#translate"];
var $get$translateLocal_translation           = assemblyscript.instance.exports["GraphNode#get:translateLocal_translation"];
var $set$translateLocal_translation           = assemblyscript.instance.exports["GraphNode#set:translateLocal_translation"];
var $translateLocal                           = assemblyscript.instance.exports["GraphNode#translateLocal"];
var $get$rotate_quaternion                    = assemblyscript.instance.exports["GraphNode#get:rotate_quaternion"];
var $set$rotate_quaternion                    = assemblyscript.instance.exports["GraphNode#set:rotate_quaternion"];
var $get$rotate_invParentRot                  = assemblyscript.instance.exports["GraphNode#get:rotate_invParentRot"];
var $set$rotate_invParentRot                  = assemblyscript.instance.exports["GraphNode#set:rotate_invParentRot"];
var $rotate                                   = assemblyscript.instance.exports["GraphNode#rotate"];
var $get$rotateLocal_quaternion               = assemblyscript.instance.exports["GraphNode#get:rotateLocal_quaternion"];
var $set$rotateLocal_quaternion               = assemblyscript.instance.exports["GraphNode#set:rotateLocal_quaternion"];
var $rotateLocal                              = assemblyscript.instance.exports["GraphNode#rotateLocal"];


function GraphNode(name?: string) {
    EventHandler.call(this);
    this.tags = new Tags(this);
    this._labels = {};
    if (typeof name === "string") {
        var strptr = Loader.allocString(name);
        assemblyscript.instance.exports.__setArgumentsLength(1);
        this.ptr = $constructor(0, strptr);
    } else {
        assemblyscript.instance.exports.__setArgumentsLength(0);
        this.ptr = $constructor(0);
    }
    list[this.ptr] = this;
}

GraphNode.prototype = Object.create(EventHandler.prototype);
GraphNode.prototype.constructor = GraphNode;

var list = {};
GraphNode.wrap = function(ptr) {
    if (ptr in list)
        return list[ptr];
    var tmp = Object.create(GraphNode.prototype);
    tmp.ptr = ptr;
    return tmp;
}

Object.defineProperty(GraphNode.prototype, 'name', {
    get: function () {
        var strptr = $get$name(this.ptr)
        return Loader.getString(strptr);
    },
    set(newName) {
        var strptr = Loader.allocString(newName);
        $set$name(this.ptr, strptr);
    }
});

Object.defineProperty(GraphNode.prototype, 'right', {
    get: function () {
        return Vec3.wrap($get$right(this.ptr));
    }
});

Object.defineProperty(GraphNode.prototype, 'up', {
    get: function () {
        return Vec3.wrap($get$up(this.ptr));
    }
});

Object.defineProperty(GraphNode.prototype, 'forward', {
    get: function () {
        return Vec3.wrap($get$forward(this.ptr));
    }
});

Object.defineProperty(GraphNode.prototype, 'enabled', {
    get: function () {
        return !!$get$enabled(this.ptr);
    },

    set: function (value) {
        $set$enabled(this.ptr, value);
    }
});

Object.defineProperty(GraphNode.prototype, '_enabled', {
    get: function () {
        return !!$get$_enabled(this.ptr);
    },

    set: function (value) {
        $set$_enabled(this.ptr, value);
    }
});

Object.defineProperty(GraphNode.prototype, 'scaleCompensation', {
    get: function () {
        return !!$get$scaleCompensation(this.ptr);
    },

    set: function (value) {
        $set$scaleCompensation(this.ptr, value);
    }
});

Object.defineProperty(GraphNode.prototype, '_enabledInHierarchy', {
    get: function () {
        return !!$get$_enabledInHierarchy(this.ptr);
    },

    set: function (value) {
        $set$_enabledInHierarchy(this.ptr, value);
    }
});

/*
var $get$_right                               = assemblyscript.instance.exports["GraphNode#get:_right"];
var $set$_right                               = assemblyscript.instance.exports["GraphNode#set:_right"];
var $get$_up                                  = assemblyscript.instance.exports["GraphNode#get:_up"];
var $set$_up                                  = assemblyscript.instance.exports["GraphNode#set:_up"];
var $get$_forward                             = assemblyscript.instance.exports["GraphNode#get:_forward"];
var $set$_forward                             = assemblyscript.instance.exports["GraphNode#set:_forward"];
var $set$_parent                              = assemblyscript.instance.exports["GraphNode#set:_parent"];
var $get$_children                            = assemblyscript.instance.exports["GraphNode#get:_children"];
var $set$_children                            = assemblyscript.instance.exports["GraphNode#set:_children"];
*/

function setterGetterObserver(object, name) {
    Object.defineProperty(object.prototype, name, {
        get: function () {
            console.error("Getter:", object, name);
            return 123;
        },
    
        set: function (value) {
            console.error("Setter:", object, name, value);
        }
    });
}
setterGetterObserver(GraphNode, "_right");
setterGetterObserver(GraphNode, "_up");
setterGetterObserver(GraphNode, "_forward");
//setterGetterObserver(GraphNode, "_children");
setterGetterObserver(GraphNode, "_sync_scale");

Object.defineProperty(GraphNode.prototype, '_frozen', {
    get: function () {
        return !!$get$_frozen(this.ptr);
    },

    set: function (value) {
        $set$_frozen(this.ptr, value);
    }
});

Object.defineProperty(GraphNode.prototype, '_dirtyNormal', {
    get: function () {
        return !!$get$_dirtyNormal(this.ptr);
    },

    set: function (value) {
        $set$_dirtyNormal(this.ptr, value);
    }
});

Object.defineProperty(GraphNode.prototype, '_dirtyLocal', {
    get: function () {
        return !!$get$_dirtyLocal(this.ptr);
    },

    set: function (value) {
        $set$_dirtyLocal(this.ptr, value);
    }
});

Object.defineProperty(GraphNode.prototype, '_dirtyWorld', {
    get: function () {
        return !!$get$_dirtyWorld(this.ptr);
    },

    set: function (value) {
        $set$_dirtyWorld(this.ptr, value);
    }
});

Object.defineProperty(GraphNode.prototype, 'worldTransform', {
    get: function () {
        return Mat4.wrap($get$worldTransform(this.ptr));
    },

    set: function (value) {
        $set$worldTransform(this.ptr, value.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, 'normalMatrix', {
    get: function () {
        return Mat3.wrap($get$normalMatrix(this.ptr));
    },

    set: function (value) {
        $set$normalMatrix(this.ptr, value.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, 'localTransform', {
    get: function () {
        return Mat4.wrap($get$localTransform(this.ptr));
    },

    set: function (value) {
        $set$localTransform(this.ptr, value.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, 'localPosition', {
    get: function () {
        return Vec3.wrap($get$localPosition(this.ptr));
    },

    set: function (value) {
        $set$localPosition(this.ptr, value.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, 'localRotation', {
    get: function () {
        return Quat.wrap($get$localRotation(this.ptr));
    },

    set: function (value) {
        $set$localRotation(this.ptr, value.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, 'localScale', {
    get: function () {
        return Vec3.wrap($get$localScale(this.ptr));
    },

    set: function (value) {
        $set$localScale(this.ptr, value.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, 'localEulerAngles', {
    get: function () {
        return Vec3.wrap($get$localEulerAngles(this.ptr));
    },

    set: function (value) {
        $set$localEulerAngles(this.ptr, value.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, '_scale', {
    get: function () {
        return Vec3.wrap($get$_scale(this.ptr));
    },

    set: function (value) {
        $set$_scale(this.ptr, value.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, 'position', {
    get: function () {
        return Vec3.wrap($get$position(this.ptr));
    },

    set: function (value) {
        $set$position(this.ptr, value.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, 'rotation', {
    get: function () {
        return Quat.wrap($get$rotation(this.ptr));
    },

    set: function (value) {
        $set$rotation(this.ptr, value.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, 'eulerAngles', {
    get: function () {
        return Vec3.wrap($get$eulerAngles(this.ptr));
    },

    set: function (value) {
        $set$eulerAngles(this.ptr, value.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, '_aabbVer', {
    get: function () {
        return $get$_aabbVer(this.ptr);
    },

    set: function (value) {
        $set$_aabbVer(this.ptr, value);
    }
});



Object.defineProperty(GraphNode.prototype, 'parent', {
    get: function () {
        var parent_ptr = $get$parent(this.ptr);
        if (parent_ptr == 0)
            return null;
        return GraphNode.wrap(parent_ptr);
    },
    set: function (value) {
        console.log("no set, value", value);
    }
});

Object.defineProperty(GraphNode.prototype, '_parent', {
    get: function () {
        var parent_ptr = $get$_parent(this.ptr);
        if (parent_ptr == 0)
            return null;
        return GraphNode.wrap(parent_ptr);
    },
    set: function (value) {
        console.log("no set, value", value);
    }
});



Object.defineProperty(GraphNode.prototype, 'path', {
    get: function () {
        return Loader.getString($get$path(this.ptr));
    }
});

Object.defineProperty(GraphNode.prototype, 'root', {
    get: function () {
        var root_ptr = $get$root(this.ptr);
        return GraphNode.wrap(root_ptr);
    }
});

function array_ptr_to_graphnodes(array_ptr: number) {
       /*
        Array<T>
            buffer: ArrayBuffer
            dataStart: uSize
            byteLength: i32
            length: i32
        */
       var struct = new Int32Array(assemblyscript.module.exports.memory.buffer, array_ptr, 4);
       var struct_buffer     = struct[0];
       var struct_dataStart  = struct[1];
       var struct_byteLength = struct[2];
       var struct_length     = struct[3];
       // e.g. [371824, 371824, 4, 1] for 1 children
       // e.g. [371824, 371824, 8, 2] for 2 children
       var childarray = new Int32Array(assemblyscript.module.exports.memory.buffer, struct_buffer, struct_length);
       var childs = [];
       for (var childelem of childarray) {
           childs.push(GraphNode.wrap(childelem));
       }
       return childs;
}

Object.defineProperty(GraphNode.prototype, 'children', {
    get: function () {
        var array_ptr = $get$children(this.ptr);
        return array_ptr_to_graphnodes(array_ptr);
    }
});

Object.defineProperty(GraphNode.prototype, '_children', {
    get: function () {
        var array_ptr = $get$_children(this.ptr);
        return array_ptr_to_graphnodes(array_ptr);
    }
});

Object.defineProperty(GraphNode.prototype, 'graphDepth', {
    get: function () {
        return $get$graphDepth(this.ptr);
    }
});

Object.defineProperty(GraphNode.prototype, '_graphDepth', {
    get: function () {
        return $get$_graphDepth(this.ptr);
    }
});

Object.assign(GraphNode.prototype, {
    _notifyHierarchyStateChanged: function (node, enabled) {
        $_notifyHierarchyStateChanged(this.ptr, node.ptr, enabled);
    },

    _onHierarchyStateChanged: function (enabled) {
        $_onHierarchyStateChanged(this.ptr, enabled);
    },

    _cloneInternal: function (clone) {
        $_cloneInternal(this.ptr, clone.ptr);
    },

    clone: function () {
        //var clone = GraphNode.wrap($clone(this.ptr));
        var clone = new GraphNode();
        this._cloneInternal(clone);
        var tags = this.tags._list;
        for (var i = 0; i < tags.length; i++)
            clone.tags.add(tags[i]);

        clone._labels = Object.assign({}, this._labels);
        return clone;
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

    isDescendantOf: function (node) {
        return !!$isDescendantOf(this.ptr, node.ptr);
    },

    isAncestorOf: function (node) {
        return !!$isAncestorOf(this.ptr, node.ptr);
    },

    getEulerAngles: function () {
        return Vec3.wrap($getEulerAngles(this.ptr));
    },

    getLocalEulerAngles: function () {
        return Vec3.wrap($getLocalEulerAngles(this.ptr));
    },

    getLocalPosition: function () {
        return Vec3.wrap($getLocalPosition(this.ptr));
    },

    getLocalRotation: function () {
        return Quat.wrap($getLocalRotation(this.ptr));
    },

    getLocalScale: function () {
        return Vec3.wrap($getLocalScale(this.ptr));
    },

    getLocalTransform: function () {
        return Mat4.wrap($getLocalTransform(this.ptr));
    },

    getPosition: function () {
        return Vec3.wrap($getPosition(this.ptr));
    },

    getRotation: function () {
        return Quat.wrap($getRotation(this.ptr));
    },

    getScale: function () {
        return Vec3.wrap($getScale(this.ptr));
    },

    getWorldTransform: function () {
        return Mat4.wrap($getWorldTransform(this.ptr))
    },

    reparent: function (parent, index) {
        $reparent(this.ptr, parent.ptr, index);
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
        if (x instanceof Vec3) {
            $setLocalEulerAngles(this.ptr, x.x, x.y, x.z);
        } else {
            $setLocalEulerAngles(this.ptr, x, y, z);
        }
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
        if (x instanceof Vec3) {
            $setLocalPosition(this.ptr, x.x, x.y, x.z);
        } else {
            $setLocalPosition(this.ptr, x, y, z);
        }
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
        if (x instanceof Quat) {
            $setLocalRotation(this.ptr, x.x, x.y, x.z, x.w);
        } else {
            $setLocalRotation(this.ptr, x, y, z, w);
        }
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
        if (x instanceof Vec3) {
            $setLocalScale(this.ptr, x.x, x.y, x.z);
        } else {
            $setLocalScale(this.ptr, x, y, z);
        }
    },

    _dirtifyLocal: function () {
        $_dirtifyLocal(this.ptr);
    },

    _unfreezeParentToRoot: function () {
        $_unfreezeParentToRoot(this.ptr);
    },

    _dirtifyWorld: function () {
        $_dirtifyWorld(this.ptr);
    },

    _dirtifyWorldInternal: function () {
        $_dirtifyWorldInternal(this.ptr);
    },

    setPosition: function() {
        var tmp = new Vec3();
        return function (x, y, z) {
            if (x instanceof Vec3) {
                tmp.copy(x);
            } else {
                tmp.set(x, y, z);
            }
            $setPosition(this.ptr, tmp.ptr);
        }
    }(),

    setRotation: function () {
        var tmp = new Quat();
        return function (x, y, z, w) {
            if (x instanceof Quat) {
                tmp.copy(x)
            } else {
                tmp.set(x, y, z, w);
            }
            $setRotation(this.ptr, tmp.ptr);
        }
    }(),

    setEulerAngles: function (x, y, z) {
        if (x instanceof Vec3) {
            $setEulerAngles(this.ptr, x.x, x.y, x.z);
        } else {
            $setEulerAngles(this.ptr, x, y, z);
        }
    },

    addChild: function (node) {
        $addChild(this.ptr, node.ptr);
    },

    //addChildAndSaveTransform: function (node) {
    //    $addChildAndSaveTransform(this.ptr, node.ptr);
    //},

    insertChild: function (node, index) {
        $insertChild(this.ptr, node.ptr, index);
    },

    // #ifdef DEBUG
    _debugInsertChild: function (node) {
        $_debugInsertChild(this.ptr, node.ptr);
    },
    // #endif

    _onInsertChild: function (node) {
        $_onInsertChild(this.ptr, node.ptr);
        
        // alert an entity that it has been inserted
        if (node.fire) node.fire('insert', this);
        
        // alert the parent that it has had a child inserted
        if (this.fire) this.fire('childinsert', node);
    },

    _updateGraphDepth: function () {
        $_updateGraphDepth(this.ptr);
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
        var removed = $removeChild(this.ptr, child.ptr);
        // removeChild returns now true/false, depending on if child was actually removed
        // So we can fire these two events for it in JS

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

        if (removed) {
            // alert child that it has been removed
            if (child.fire) {
                child.fire('remove', this);
            }

            // alert the parent that it has had a child removed
            if (this.fire) {
                this.fire('childremove', child);
            }
        }
    },

    _sync: function () {
        $_sync(this.ptr);
    },

    syncHierarchy: function () {
        $syncHierarchy(this.ptr);
    },

    lookAt: function () {
        var target = new Vec3();
        var up = new Vec3();
        
        return function (tx, ty, tz, ux, uy, uz) {
            if (tx instanceof Vec3) {
                target.copy(tx);
        
                if (ty instanceof Vec3) { // vec3, vec3
                    up.copy(ty);
                } else { // vec3
                    up.copy(Vec3.UP);
                }
            } else if (tz === undefined) {
                return;
            } else {
                target.set(tx, ty, tz);
        
                if (ux !== undefined) { // number, number, number, number, number, number
                    up.set(ux, uy, uz);
                } else { // number, number, number
                    up.copy(Vec3.UP);
                }
            }
            $lookAt(this.ptr, target.x, target.y, target.z, up.x, up.y, up.z);
        };
    }(),

    translate: function (x, y, z) {
        //var translation = new Vec3();
        
        //return function (x, y, z) {
            if (x instanceof Vec3) {
                $translate(this.ptr, x.x, x.y, x.z);
            } else {
                $translate(this.ptr, x, y, z);
            }
        //};
    },//(),

    translateLocal: function (x, y, z) {
        
        //var translation = new Vec3();
        //
        //return function (x, y, z) {
            if (x instanceof Vec3) {
                //translation.copy(x);
                $translateLocal(this.ptr, x.x, x.y, x.z);
            } else {
                $translateLocal(this.ptr, x, y, z);
            }
        //
        //    this.localRotation.transformVector(translation, translation);
        //    this.localPosition.add(translation);
        //
        //    if (!this._dirtyLocal)
        //        this._dirtifyLocal();
        //};
    },//(),

    rotate: function (x, y, z) {
        //var quaternion = new Quat();
        //var invParentRot = new Quat();
        //
        //return function (x, y, z) {
            if (x instanceof Vec3) {
                $rotate(this.ptr, x.x, x.y, x.z);
            } else {
                $rotate(this.ptr, x, y, z);
            }
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
    rotateLocal: function (x, y, z) {
        //var quaternion = new Quat();
        //
        //return function (x, y, z) {
            if (x instanceof Vec3) {
                $rotateLocal(this.ptr, x.x, x.y, x.z);
            } else {
                $rotateLocal(this.ptr, x, y, z);
            }
        //
        //    this.localRotation.mul(quaternion);
        //
        //    if (!this._dirtyLocal)
        //        this._dirtifyLocal();
        //};
    }//()
});

export { GraphNode };
