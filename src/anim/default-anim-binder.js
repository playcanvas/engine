import { AnimPropertyLocator } from '../framework/components/anim/property-locator.js';
import { Entity } from '../framework/entity.js';

import { AnimTarget } from './anim-target.js';

/**
 * @private
 * @class
 * @name pc.DefaultAnimBinder
 * @implements {pc.AnimBinder}
 * @classdesc Implementation of {@link pc.AnimBinder} for animating a skeleton in the graph-node
 * hierarchy.
 */
class DefaultAnimBinder {
    constructor(graph) {
        var nodes = { };

        // cache node names so we can quickly resolve animation paths
        var flatten = function (node) {
            nodes[node.name] = {
                node: node,
                count: 0
            };
            for (var i = 0; i < node.children.length; ++i) {
                flatten(node.children[i]);
            }
        };
        flatten(graph);

        var findMeshInstances = function (node) {

            // walk up to the first parent node of entity type (skips internal nodes of Model)
            var object = node;
            while (object && !(object instanceof Entity)) {
                object = object.parent;
            }

            // get meshInstances from either model or render component
            var meshInstances;
            if (object) {
                if (object.render) {
                    meshInstances = object.render.meshInstances;
                } else if (object.model) {
                    meshInstances = object.model.meshInstances;
                }
            }
            return meshInstances;
        };

        this.nodes = nodes;                 // map of node name -> { node, count }
        this.activeNodes = [];              // list of active nodes
        this.handlers = {
            'localPosition': function (node) {
                var object = node.localPosition;
                var func = function (value) {
                    object.set.apply(object, value);
                };
                return new AnimTarget(func, 'vector', 3);
            },

            'localRotation': function (node) {
                var object = node.localRotation;
                var func = function (value) {
                    object.set.apply(object, value);
                };
                return new AnimTarget(func, 'quaternion', 4);
            },

            'localScale': function (node) {
                var object = node.localScale;
                var func = function (value) {
                    object.set.apply(object, value);
                };
                return new AnimTarget(func, 'vector', 3);
            },

            'weights': function (node) {
                var meshInstances = findMeshInstances(node);
                if (meshInstances) {
                    var morphInstance;
                    for (var i = 0; i < meshInstances.length; ++i) {
                        if (meshInstances[i].node.name === node.name && meshInstances[i].morphInstance) {
                            morphInstance = meshInstances[i].morphInstance;
                            break;
                        }
                    }
                    if (morphInstance) {
                        var func = function (value) {
                            for (var i = 0; i < value.length; ++i) {
                                morphInstance.setWeight(i, value[i]);
                            }
                        };
                        return new AnimTarget(func, 'vector', morphInstance.morph._targets.length);
                    }
                }

                return null;
            },
            'materialTexture': function (node, textureName) {
                var meshInstances = findMeshInstances(node);
                if (meshInstances) {
                    var meshInstance;
                    for (var i = 0; i < meshInstances.length; ++i) {
                        if (meshInstances[i].node.name === node.name) {
                            meshInstance = meshInstances[i];
                            break;
                        }
                    }
                    if (meshInstance) {
                        var func = function (value) {
                            var textureAsset = this.animComponent.system.app.assets.get(value[0]);
                            if (textureAsset && textureAsset.resource && textureAsset.type === 'texture') {
                                meshInstance.material[textureName] = textureAsset.resource;
                                meshInstance.material.update();
                            }
                        }.bind(this);
                        return new AnimTarget(func, 'vector', 1);
                    }
                }

                return null;
            }.bind(this)
        };

        this.propertyLocator = new AnimPropertyLocator();
    }

    resolve(path) {
        var pathSections = this.propertyLocator.decode(path);

        var node = this.nodes[pathSections[0][0] || ""];
        if (!node) {
            return null;
        }

        var handler = this.handlers[pathSections[2][0]];
        if (!handler) {
            return null;
        }

        var target = handler(node.node);
        if (!target) {
            return null;
        }

        if (node.count === 0) {
            this.activeNodes.push(node.node);
        }
        node.count++;

        return target;
    }

    unresolve(path) {
        var pathSections = this.propertyLocator.decode(path);
        if (pathSections[1] !== 'graph')
            return;

        var node = this.nodes[pathSections[0][0]];

        node.count--;
        if (node.count === 0) {
            var activeNodes = this.activeNodes;
            var i = activeNodes.indexOf(node.node);  // :(
            var len = activeNodes.length;
            if (i < len - 1) {
                activeNodes[i] = activeNodes[len - 1];
            }
            activeNodes.pop();
        }
    }

    // flag animating nodes as dirty
    update(deltaTime) {
        var activeNodes = this.activeNodes;
        for (var i = 0; i < activeNodes.length; ++i) {
            activeNodes[i]._dirtifyLocal();
        }
    }
}

export { DefaultAnimBinder };
