import { AnimBinder } from './anim-binder.js';
import { AnimTarget } from '../evaluator/anim-target.js';
import { Entity } from '../../framework/entity.js';
/**
 * @private
 * @class
 * @name DefaultAnimBinder
 * @implements {AnimBinder}
 * @classdesc Implementation of {@link AnimBinder} for animating a skeleton in the graph-node
 * hierarchy.
 */
class DefaultAnimBinder {
    constructor(graph) {
        this.graph = graph;

        if (!graph) return;

        var nodes = { };
        // cache node names so we can quickly resolve animation paths
        var flatten = function (node) {
            nodes[node.name] = node;
            for (var i = 0; i < node.children.length; ++i) {
                flatten(node.children[i]);
            }
        };
        flatten(graph);
        this.nodes = nodes;
        this.targetCache = {};
        // #if _DEBUG
        this.visitedFallbackGraphPaths = {};
        // #endif

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

        this.nodeCounts = {};                 // map of node path -> count
        this.activeNodes = [];              // list of active nodes
        this.handlers = {
            'localPosition': function (node) {
                var object = node.localPosition;
                var func = function (value) {
                    object.set(...value);
                };
                return DefaultAnimBinder.createAnimTarget(func, 'vector', 3, node, 'localPosition');
            },

            'localRotation': function (node) {
                var object = node.localRotation;
                var func = function (value) {
                    object.set(...value);
                };
                return DefaultAnimBinder.createAnimTarget(func, 'quaternion', 4, node, 'localRotation');
            },

            'localScale': function (node) {
                var object = node.localScale;
                var func = function (value) {
                    object.set(...value);
                };
                return DefaultAnimBinder.createAnimTarget(func, 'vector', 3, node, 'localScale');
            },

            'weights': function (node) {
                var meshInstances = findMeshInstances(node);
                if (meshInstances) {
                    var morphInstances = [];
                    for (var i = 0; i < meshInstances.length; ++i) {
                        if (meshInstances[i].node.name === node.name && meshInstances[i].morphInstance) {
                            morphInstances.push(meshInstances[i].morphInstance);
                        }
                    }
                    if (morphInstances.length > 0) {
                        var func = function (value) {
                            for (var i = 0; i < value.length; ++i) {
                                for (var j = 0; j < morphInstances.length; j++) {
                                    morphInstances[j].setWeight(i, value[i]);
                                }
                            }
                        };
                        return DefaultAnimBinder.createAnimTarget(func, 'vector', morphInstances[0].morph._targets.length, node, 'weights');
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
                        return DefaultAnimBinder.createAnimTarget(func, 'vector', 1, node, 'materialTexture', 'material');
                    }
                }

                return null;
            }.bind(this)
        };
    }

    findNode(path) {
        var node;
        if (this.graph) {
            node = this.graph.findByPath(path.entityPath);
        }
        if (!node) {
            node = this.nodes[path.entityPath[path.entityPath.length - 1] || ""];

            // #if _DEBUG
            var fallbackGraphPath = AnimBinder.encode(path.entityPath[path.entityPath.length - 1] || "", 'graph', path.propertyPath);
            if (this.visitedFallbackGraphPaths[fallbackGraphPath] === 1) {
                console.warn('Anim Binder: Multiple animation curves with the path ' + fallbackGraphPath + ' are present in the ' + this.graph.path + ' graph which may result in the incorrect binding of animations');
            }
            if (!Number.isFinite(this.visitedFallbackGraphPaths[fallbackGraphPath])) {
                this.visitedFallbackGraphPaths[fallbackGraphPath] = 0;
            } else {
                this.visitedFallbackGraphPaths[fallbackGraphPath]++;
            }
            // #endif
        }
        return node;
    }

    static createAnimTarget(func, type, valueCount, node, propertyPath, componentType) {
        var targetPath = AnimBinder.encode(node.path, componentType ? componentType : 'entity', propertyPath);
        return new AnimTarget(func, type, valueCount, targetPath);
    }

    resolve(path) {
        var encodedPath = AnimBinder.encode(path.entityPath, path.component, path.propertyPath);
        var target = this.targetCache[encodedPath];
        if (target) return target;

        var node = this.findNode(path);
        if (!node) {
            return null;
        }

        var handler = this.handlers[path.propertyPath];
        if (!handler) {
            return null;
        }

        target = handler(node);
        if (!target) {
            return null;
        }

        this.targetCache[encodedPath] = target;

        if (!this.nodeCounts[node.path]) {
            this.activeNodes.push(node);
            this.nodeCounts[node.path] = 1;
        } else {
            this.nodeCounts[node.path]++;
        }

        return target;
    }

    unresolve(path) {
        if (path.component !== 'graph')
            return;

        var node = this.nodes[path.entityPath[path.entityPath.length - 1] || ""];

        this.nodeCounts[node.path]--;
        if (this.nodeCounts[node.path] === 0) {
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
