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

    _setComponentProperty: function (propertyComponent, propertyHierarchy) {
        // trigger the component property setter function
        propertyComponent[propertyHierarchy[0]] = propertyComponent[propertyHierarchy[0]]; // eslint-disable-line no-self-assign
    },

    _floatSetter: function (propertyComponent, propertyHierarchy) {
        var propertyParent = this._getProperty(propertyComponent, propertyHierarchy, true);
        var propertyKey = propertyHierarchy[propertyHierarchy.length - 1];
        var setter = function (values) {
            propertyParent[propertyKey] = values[0];
            this._setComponentProperty(propertyComponent, propertyHierarchy);
        };
        return setter.bind(this);
    },
    _booleanSetter: function (propertyComponent, propertyHierarchy) {
        var propertyParent = this._getProperty(propertyComponent, propertyHierarchy, true);
        var propertyKey = propertyHierarchy[propertyHierarchy.length - 1];
        var setter = function (values) {
            propertyParent[propertyKey] = !!values[0];
            this._setComponentProperty(propertyComponent, propertyHierarchy);
        };
        return setter.bind(this);
    },
    _colorSetter: function (propertyComponent, propertyHierarchy) {
        var color = this._getProperty(propertyComponent, propertyHierarchy);
        var setter = function (values) {
            if (values[0]) color.r = values[0];
            if (values[1]) color.g = values[1];
            if (values[2]) color.b = values[2];
            if (values[3]) color.a = values[3];
            this._setComponentProperty(propertyComponent, propertyHierarchy);
        };
        return setter.bind(this);
    },
    _vecSetter: function (propertyComponent, propertyHierarchy) {
        var vector = this._getProperty(propertyComponent, propertyHierarchy);
        var setter = function (values) {
            if (values[0]) vector.x = values[0];
            if (values[1]) vector.y = values[1];
            if (values[2]) vector.z = values[2];
            if (values[3]) vector.w = values[3];
            this._setComponentProperty(propertyComponent, propertyHierarchy);
        };
        return setter.bind(this);
    },

    _getProperty: function (propertyComponent, propertyHierarchy, returnParent) {
        var property = propertyComponent;
        var steps = propertyHierarchy.length;
        if (returnParent) {
            steps--;
        }
        for (var i = 0; i < steps; i++) {
            property = property[propertyHierarchy[i]];
        }
        return property;
    },

    _getEntityProperty: function (propertyHierarchy) {
        var entityProperties = [
            'localScale',
            'localPosition',
            'localRotation',
            'localEulerAngles',
            'position',
            'rotation',
            'eulerAngles'
        ];
        var entityProperty;
        for (var i = 0; i < entityProperties.length; i++) {
            if (propertyHierarchy.indexOf(entityProperties[i]) !== -1) {
                entityProperty = entityProperties[i];
            }
        }
        return entityProperty;
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

        var property = this._getProperty(propertyComponent, propertyHierarchy);

        if (typeof property === 'undefined')
            return null;

        var setter;
        var animDataType;
        var animDataComponents;

        if (typeof property === 'number') {
            setter = this._floatSetter(propertyComponent, propertyHierarchy);
            animDataType = 'vector';
            animDataComponents = 1;
        } else if (typeof property === 'boolean') {
            setter = this._booleanSetter(propertyComponent, propertyHierarchy);
            animDataType = 'vector';
            animDataComponents = 1;
        } else if (typeof property === 'object') {
            switch (property.constructor) {
                case Vec2:
                    setter = this._vecSetter(propertyComponent, propertyHierarchy);
                    animDataType = 'vector';
                    animDataComponents = 2;
                    break;
                case Vec3:
                    setter = this._vecSetter(propertyComponent, propertyHierarchy);
                    animDataType = 'vector';
                    animDataComponents = 3;
                    break;
                case Vec4:
                    setter = this._vecSetter(propertyComponent, propertyHierarchy);
                    animDataType = 'vector';
                    animDataComponents = 4;
                    break;
                case Color:
                    setter = this._colorSetter(propertyComponent, propertyHierarchy);
                    animDataType = 'vector';
                    animDataComponents = 4;
                    break;
                case Quat:
                    setter = this._vecSetter(propertyComponent, propertyHierarchy);
                    animDataType = 'quaternion';
                    animDataComponents = 4;
                    break;
                default:
                    return null;
            }
        }

        // for entity properties we cannot just set their values, we must also call the values setter function.
        var entityProperty = this._getEntityProperty(propertyHierarchy);
        if (entityProperty) {
            // create the function name of the entity properties setter
            var entityPropertySetterFunctionName = "set" +
                entityProperty.substring(0, 1).toUpperCase() +
                entityProperty.substring(1);
            // record the function for entities animated property
            var entityPropertySetterFunction = propertyComponent[entityPropertySetterFunctionName].bind(propertyComponent);
            // store the property
            var propertyObject = this._getProperty(propertyComponent, [entityProperty]);
            var entityPropertySetter = function (values) {
                // first set new values on the property as before
                setter(values);
                // call the setter function for entities animated property using the newly set property value
                entityPropertySetterFunction(propertyObject);
            };
            return new AnimTarget(entityPropertySetter.bind(this), animDataType, animDataComponents);
        } else if (propertyHierarchy.indexOf('material') !== -1) {
            return new AnimTarget(function (values) {
                setter(values);
                propertyComponent.material.update();
            }, animDataType, animDataComponents);
        }

        return new AnimTarget(setter, animDataType, animDataComponents);

    }
});

export { AnimComponentBinder };
