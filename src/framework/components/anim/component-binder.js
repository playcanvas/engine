import { AnimTarget } from '../../anim/evaluator/anim-target.js';
import { DefaultAnimBinder } from '../../anim/binder/default-anim-binder.js';
import { AnimBinder } from '../../anim/binder/anim-binder.js';

import { Color } from '../../../core/math/color.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Vec4 } from '../../../core/math/vec4.js';

const v2 = new Vec2();
const v3 = new Vec3();
const v4 = new Vec4();
const c  = new Color();
const q  = new Quat();

class AnimComponentBinder extends DefaultAnimBinder {
    constructor(animComponent, graph, layerName, mask, layerIndex) {
        super(graph);
        this.animComponent = animComponent;
        this._mask = mask;
        this.layerName = layerName;
        this.layerIndex = layerIndex;
    }

    static _packFloat(values) {
        return values[0];
    }

    static _packBoolean(values) {
        return !!values[0];
    }

    static _packVec2(values) {
        v2.x = values[0];
        v2.y = values[1];
        return v2;
    }

    static _packVec3(values) {
        v3.x = values[0];
        v3.y = values[1];
        v3.z = values[2];
        return v3;
    }

    static _packVec4(values) {
        v4.x = values[0];
        v4.y = values[1];
        v4.z = values[2];
        v4.w = values[3];
        return v4;
    }

    static _packColor(values) {
        c.r = values[0];
        c.g = values[1];
        c.b = values[2];
        c.a = values[3];
        return c;
    }

    static _packQuat(values) {
        q.x = values[0];
        q.y = values[1];
        q.z = values[2];
        q.w = values[3];
        return q;
    }

    resolve(path) {
        const encodedPath = AnimBinder.encode(path.entityPath, path.component, path.propertyPath);
        let target = this.targetCache[encodedPath];
        if (target) return target;

        let entity;
        let propertyComponent;
        let targetPath;

        switch (path.component) {
            case 'entity':
                entity = this._getEntityFromHierarchy(path.entityPath);
                targetPath = AnimBinder.encode(
                    entity.path,
                    'entity',
                    path.propertyPath
                );
                propertyComponent = entity;
                break;
            case 'graph':
                propertyComponent = this.findNode(path);
                if (!propertyComponent) return null;
                targetPath = AnimBinder.encode(
                    propertyComponent.path,
                    'graph',
                    path.propertyPath
                );
                break;
            default:
                entity = this._getEntityFromHierarchy(path.entityPath);
                propertyComponent = entity.findComponent(path.component);
                if (!propertyComponent)
                    return null;
                targetPath = AnimBinder.encode(
                    entity.path,
                    path.component,
                    path.propertyPath
                );
                break;
        }

        target = this._createAnimTargetForProperty(propertyComponent, path.propertyPath, targetPath);
        this.targetCache[encodedPath] = target;
        return target;
    }

    update(deltaTime) {
        // flag active nodes as dirty
        const activeNodes = this.activeNodes;
        if (activeNodes) {
            for (let i = 0; i < activeNodes.length; i++) {
                activeNodes[i]._dirtifyLocal();
            }
        }
    }

    _getEntityFromHierarchy(entityHierarchy) {
        if (!this.animComponent.entity.name === entityHierarchy[0]) {
            return null;
        }

        const currEntity = this.animComponent.entity;

        if (entityHierarchy.length === 1) {
            return currEntity;
        }
        return currEntity._parent.findByPath(entityHierarchy);
    }

    // resolve an object path
    _resolvePath(object, path, resolveLeaf) {
        const steps = path.length - (resolveLeaf ? 0 : 1);
        for (let i = 0; i < steps; i++) {
            object = object[path[i]];
        }
        return object;
    }

    // construct a setter function for the property located at 'path' from the base object. packFunc
    // is a function which takes the animation values array and packages them for the target property
    // in the correct format (i.e. vec2, quat, color etc).
    _setter(object, path, packFunc) {
        const obj = this._resolvePath(object, path);
        const key = path[path.length - 1];

        // if the object has a setter function, use it
        const setterFuncName = 'set' + key.substring(0, 1).toUpperCase() + key.substring(1);
        if (obj[setterFuncName]) {
            // if the object has a setter function, use it
            const getterFunc = obj['get' + key.substring(0, 1).toUpperCase() + key.substring(1)].bind(obj);
            let baseValues = getterFunc();
            baseValues = [baseValues.x, baseValues.y, baseValues.z, baseValues.w];
            const setterFunc = obj[setterFuncName].bind(obj);
            return {
                set: (values) => {
                    setterFunc(packFunc(values));
                },
                get: () => baseValues
            };
        }

        const prop = obj[key];

        // if the target property has a copy function, use it (vec3, color, quat)
        if (typeof prop === 'object' && prop.hasOwnProperty('copy')) {
            return function (values) {
                prop.copy(packFunc(values));
            };
        }

        // when animating individual members of vec/color/quaternion, we must also invoke the
        // object's setter. this is required by some component properties which have custom
        // handlers which propagate the changes correctly.
        if ([Vec2, Vec3, Vec4, Color, Quat].indexOf(obj.constructor) !== -1 && path.length > 1) {
            const parent = path.length > 2 ? this._resolvePath(object, path.slice(0, -1)) : object;
            const objKey = path[path.length - 2];
            return function (values) {
                obj[key] = packFunc(values);
                parent[objKey] = obj;
            };
        }

        // otherwise set the property directly (float, boolean)
        return function (values) {
            obj[key] = packFunc(values);
        };
    }

    _createAnimTargetForProperty(propertyComponent, propertyHierarchy, targetPath) {

        if (this.handlers && propertyHierarchy[0].startsWith('weight.')) {
            return this.handlers.weight(propertyComponent, propertyHierarchy[0].replace('weight.', ''));
        } else if (this.handlers && propertyHierarchy[0] === 'material' && propertyHierarchy.length === 2) {
            const materialPropertyName = propertyHierarchy[1];
            // if the property name ends in Map then we're binding a material texture
            if (materialPropertyName.endsWith('Map')) {
                return this.handlers.materialTexture(propertyComponent, materialPropertyName);
            }
        }

        const property = this._resolvePath(propertyComponent, propertyHierarchy, true);

        if (typeof property === 'undefined')
            return null;

        let setter;
        let animDataType;
        let animDataComponents;

        if (typeof property === 'number') {
            setter = this._setter(propertyComponent, propertyHierarchy, AnimComponentBinder._packFloat);
            animDataType = 'vector';
            animDataComponents = 1;
        } else if (typeof property === 'boolean') {
            setter = this._setter(propertyComponent, propertyHierarchy, AnimComponentBinder._packBoolean);
            animDataType = 'vector';
            animDataComponents = 1;
        } else if (typeof property === 'object') {
            switch (property.constructor) {
                case Vec2:
                    setter = this._setter(propertyComponent, propertyHierarchy, AnimComponentBinder._packVec2);
                    animDataType = 'vector';
                    animDataComponents = 2;
                    break;
                case Vec3:
                    setter = this._setter(propertyComponent, propertyHierarchy, AnimComponentBinder._packVec3);
                    animDataType = 'vector';
                    animDataComponents = 3;
                    break;
                case Vec4:
                    setter = this._setter(propertyComponent, propertyHierarchy, AnimComponentBinder._packVec4);
                    animDataType = 'vector';
                    animDataComponents = 4;
                    break;
                case Color:
                    setter = this._setter(propertyComponent, propertyHierarchy, AnimComponentBinder._packColor);
                    animDataType = 'vector';
                    animDataComponents = 4;
                    break;
                case Quat:
                    setter = this._setter(propertyComponent, propertyHierarchy, AnimComponentBinder._packQuat);
                    animDataType = 'quaternion';
                    animDataComponents = 4;
                    break;
                default:
                    return null;
            }
        }

        // materials must have update called after changing settings
        if (propertyHierarchy.indexOf('material') !== -1) {
            return new AnimTarget(function (values) {
                setter(values);
                propertyComponent.material.update();
            }, animDataType, animDataComponents, targetPath);
        }

        return new AnimTarget(setter, animDataType, animDataComponents, targetPath);
    }

    rebind() {
        this.targetCache = {};
        // #if _DEBUG
        this.visitedFallbackGraphPaths = {};
        // #endif

        if (this.animComponent.rootBone) {
            this.graph = this.animComponent.rootBone;
        } else {
            this.graph = this.animComponent.entity;
        }

        const nodes = { };
        // cache node names so we can quickly resolve animation paths
        const flatten = function (node) {
            nodes[node.name] = node;
            for (let i = 0; i < node.children.length; ++i) {
                flatten(node.children[i]);
            }
        };
        flatten(this.graph);
        this.nodes = nodes;
    }
}

export { AnimComponentBinder };
