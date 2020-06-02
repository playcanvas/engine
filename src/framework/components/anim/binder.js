Object.assign(pc, function () {

    var AnimComponentBinder = function (animComponent, graph) {
        this.animComponent = animComponent;

        if (graph) {
            pc.DefaultAnimBinder.call(this, graph);
        } else {
            this.propertyLocator = new pc.AnimPropertyLocator();
        }
    };

    AnimComponentBinder.prototype = Object.create(pc.DefaultAnimBinder.prototype);
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

            // if (entity)
            // var nodeEntity = currEntity.findByPath(entityHierarchy.join('/'));
            // if (!nodeEntity) {
            // nodeEntity = currEntity.findByName(entityHierarchy.join('/'));
            // }
            // // return nodeEntity;
            // for (var i = 0; i < entityHierarchy.length - 1; i++) {
            //     var entityChildren = currEntity.getChildren();
            //     var child;
            //     for (var j = 0; j < entityChildren.length; j++) {
            //         if (entityChildren[j].name === entityHierarchy[i + 1]) {
            //             child = entityChildren[j];
            //             break;
            //         }
            //     }
            //     if (child)
            //         currEntity = child;
            //     else
            //         return null;
            // }
            // return currEntity;
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

        _getObjectPropertyType: function (property) {
            if (!property.constructor)
                return undefined;

            return property.constructor.name;
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
                switch (this._getObjectPropertyType(property)) {
                    case 'Vec2':
                        setter = this._vecSetter(propertyComponent, propertyHierarchy);
                        animDataType = 'vector';
                        animDataComponents = 2;
                        break;
                    case 'Vec3':
                        setter = this._vecSetter(propertyComponent, propertyHierarchy);
                        animDataType = 'vector';
                        animDataComponents = 3;
                        break;
                    case 'Vec4':
                        setter = this._vecSetter(propertyComponent, propertyHierarchy);
                        animDataType = 'vector';
                        animDataComponents = 4;
                        break;
                    case 'Color':
                        setter = this._colorSetter(propertyComponent, propertyHierarchy);
                        animDataType = 'vector';
                        animDataComponents = 4;
                        break;
                    case 'Quat':
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
                    var entityPropertySetterFunctionName = pc.string.format(
                        'set{0}{1}',
                        entityProperty.substring(0, 1).toUpperCase(),
                        entityProperty.substring(1)
                    );
                    // call the setter function for entities updated property using the newly set property value
                    propertyComponent[entityPropertySetterFunctionName](this._getProperty(propertyComponent, [entityProperty]));
                };
                return new pc.AnimTarget(entityPropertySetter.bind(this), animDataType, animDataComponents);
            }
            return new pc.AnimTarget(setter, animDataType, animDataComponents);

        }
    });

    return {
        AnimComponentBinder: AnimComponentBinder
    };
}());
