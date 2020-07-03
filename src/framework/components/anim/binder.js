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
                if (!this.nodes[entityHierarchy[0]]) {
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
            for (var i = 0; i < activeNodes.length; ++i) {
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

    _floatSetter: function (propertyComponent, propertyHierarchy) {
        var setter = function (values) {
            this._setProperty(propertyComponent, propertyHierarchy, values[0]);
        };
        return setter.bind(this);
    },
    _booleanSetter: function (propertyComponent, propertyHierarchy) {
        var setter = function (values) {
            this._setProperty(propertyComponent, propertyHierarchy, !!values[0]);
        };
        return setter.bind(this);
    },
    _colorSetter: function (propertyComponent, propertyHierarchy) {
        var colorKeys = ['r', 'g', 'b', 'a'];
        var setter = function (values) {
            for (var i = 0; i < values.length; i++) {
                this._setProperty(propertyComponent, propertyHierarchy.concat(colorKeys[i]), values[i]);
            }
        };
        return setter.bind(this);
    },
    _vecSetter: function (propertyComponent, propertyHierarchy) {
        var vectorKeys = ['x', 'y', 'z', 'w'];
        var setter = function (values) {
            for (var i = 0; i < values.length; i++) {
                this._setProperty(propertyComponent, propertyHierarchy.concat(vectorKeys[i]), values[i]);
            }
        };
        return setter.bind(this);
    },

    _getProperty: function (propertyComponent, propertyHierarchy) {
        if (propertyHierarchy.length === 1) {
            return propertyComponent[propertyHierarchy[0]];
        }
        var propertyObject = propertyComponent[propertyHierarchy[0]];
        return propertyObject[propertyHierarchy[1]];

    },

    _setProperty: function (propertyComponent, propertyHierarchy, value) {
        if (propertyHierarchy.length === 1) {
            propertyComponent[propertyHierarchy[0]] = value;
        } else {
            var propertyObject = propertyComponent[propertyHierarchy[0]];
            propertyObject[propertyHierarchy[1]] = value;
            propertyComponent[propertyHierarchy[0]] = propertyObject;
        }
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
            var entityPropertySetter = function (values) {
                // first set new values on the property as before
                setter(values);

                // create the function name of the entity properties setter
                var entityPropertySetterFunctionName = "set" +
                    entityProperty.substring(0, 1).toUpperCase() +
                    entityProperty.substring(1);

                // call the setter function for entities updated property using the newly set property value
                propertyComponent[entityPropertySetterFunctionName](this._getProperty(propertyComponent, [entityProperty]));
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
