import { AnimTarget, DefaultAnimBinder } from '../../../anim/anim.js';

import { Color } from '../../../core/color.js';

import { Quat } from '../../../math/quat.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';
import { Vec4 } from '../../../math/vec4.js';

import { AnimPropertyLocator } from './property-locator.js';

function AnimComponentBinder(animComponent, graph) {
    this.animComponent = animComponent;

    if (graph) {
        DefaultAnimBinder.call(this, graph);
    } else {
        this.propertyLocator = new AnimPropertyLocator();
    }
}
AnimComponentBinder.prototype = Object.create(DefaultAnimBinder.prototype);
AnimComponentBinder.prototype.constructor = AnimComponentBinder;

AnimComponentBinder._packFloat = function (values) {
    return values[0];
};

AnimComponentBinder._packBoolean = function (values) {
    return !!values[0];
};

AnimComponentBinder._packVec2 = function () {
    var v = new Vec2();
    return function (values) {
        v.x = values[0];
        v.y = values[1];
        return v;
    };
}();

AnimComponentBinder._packVec3 = function () {
    var v = new Vec3();
    return function (values) {
        v.x = values[0];
        v.y = values[1];
        v.z = values[2];
        return v;
    };
}();

AnimComponentBinder._packVec4 = function () {
    var v = new Vec4();
    return function (values) {
        v.x = values[0];
        v.y = values[1];
        v.z = values[2];
        v.w = values[3];
        return v;
    };
}();

AnimComponentBinder._packColor = function () {
    var v = new Color();
    return function (values) {
        v.r = values[0];
        v.g = values[1];
        v.b = values[2];
        v.a = values[3];
        return v;
    };
}();

AnimComponentBinder._packQuat = function () {
    var v = new Quat();
    return function (values) {
        v.x = values[0];
        v.y = values[1];
        v.z = values[2];
        v.w = values[3];
        return v;
    };
}();

Object.assign(AnimComponentBinder.prototype, {
    resolve: function (path) {
        var pathSections = this.propertyLocator.decode(path);

        var entityHierarchy = pathSections[0];
        var component = pathSections[1];
        var propertyHierarchy = pathSections[2];

        var entity = this._getEntityFromHierarchy(entityHierarchy);

        if (!entity)
            return null;

        var propertyComponent;

        switch (component) {
            case 'entity':
                propertyComponent = entity;
                break;
            case 'graph':
                if (!this.nodes || !this.nodes[entityHierarchy[0]]) {
                    return null;
                }
                propertyComponent = this.nodes[entityHierarchy[0]].node;
                break;
            default:
                propertyComponent = entity.findComponent(component);
                if (!propertyComponent)
                    return null;
        }

        return this._createAnimTargetForProperty(propertyComponent, propertyHierarchy);
    },

    update: function (deltaTime) {
        // flag active nodes as dirty
        var activeNodes = this.activeNodes;
        if (activeNodes) {
            for (var i = 0; i < activeNodes.length; i++) {
                activeNodes[i]._dirtifyLocal();
            }
        }
    },

    _getEntityFromHierarchy: function (entityHierarchy) {
        if (!this.animComponent.entity.name === entityHierarchy[0]) {
            return null;
        }

        var currEntity = this.animComponent.entity;

        if (entityHierarchy.length === 1) {
            return currEntity;
        }
        return currEntity._parent.findByPath(entityHierarchy.join('/'));
    },

    // resolve an object path
    _resolvePath: function (object, path) {
        var steps = path.length - 1;
        for (var i = 0; i < steps; i++) {
            object = object[path[i]];
        }
        return object;
    },

    // construct a setter function for the property located at 'path' from the base object. packFunc
    // is a function which takes the animation values array and packages them for the target property
    // (in the correct format, i.e. vec2, quat, color etc).
    _setter: function (object, path, packFunc) {
        var obj = this._resolvePath(object, path);
        var key = path[path.length - 1];

        // if the object has a setter function, use it
        var setterFunc = "set" + key.substring(0, 1).toUpperCase() + key.substring(1);
        if (obj[setterFunc]) {
            var func = obj[setterFunc].bind(obj);
            return function (values) {
                func(packFunc(values));
            };
        }

        var prop = obj[key];

        // if the target property has a copy function, use it (vec3, color, quat)
        if (prop.copy) {
            return function (values) {
                prop.copy(packFunc(values));
            };
        }

        // otherwise set the property directly (float, boolean)
        return function (values) {
            obj[key] = packFunc(values);
        };
    },

    _createAnimTargetForProperty: function (propertyComponent, propertyHierarchy) {

        if (this.handlers && propertyHierarchy[0] === 'weights') {
            return this.handlers.weights(propertyComponent);
        } else if (this.handlers && propertyHierarchy[0] === 'material' && propertyHierarchy.length === 2) {
            var materialPropertyName = propertyHierarchy[1];
            // if the property name ends in Map then we're binding a material texture
            if (materialPropertyName.indexOf('Map') === materialPropertyName.length - 3) {
                return this.handlers.materialTexture(propertyComponent, materialPropertyName);
            }
        }

        var property = this._resolvePath(propertyComponent, propertyHierarchy);

        if (typeof property === 'undefined')
            return null;

        var setter;
        var animDataType;
        var animDataComponents;

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
            }, animDataType, animDataComponents);
        }

        return new AnimTarget(setter, animDataType, animDataComponents);
    }
});

export { AnimComponentBinder };
