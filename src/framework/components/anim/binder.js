Object.assign(pc, function () {

    var AnimComponentBinder = function (animComponent, graph) {
        this.animComponent = animComponent;
        this.propertyLocator = new pc.AnimPropertyLocator();

        if (graph) {
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

            this.nodes = nodes;                 // map of node name -> { node, count }
            this.activeNodes = [];              // list of active nodes
        }
    };

    Object.assign(AnimComponentBinder.prototype, {
        resolve: function(path) {
            var pathSections = this.propertyLocator.decode(path);

            var entityHeirarchy = pathSections[0];
            var component = pathSections[1];
            var propertyHeirarchy = pathSections[2];

            var entity = this._getEntityFromHeirarchy(entityHeirarchy);
            
            if (!entity)
                return null;

            var propertyComponent;

            switch(component) {
                case 'entity':
                    propertyComponent = entity;
                    break;
                case 'graph':
                    propertyComponent = this.nodes[entityHeirarchy[0]].node;
                    break;
                default:
                    entity.findComponent(component);
                    if (!propertyComponent)
                        return null;
            }

            return this._createAnimTargetForProperty(propertyComponent, propertyHeirarchy);
        },

        unresolve: function (path) {
            var pathSections = this.propertyLocator.decode(path);
            if (pathSections[1] !== 'graph')
                return;

            // get the path parts. we expect parts to have structure nodeName.[translation|rotation|scale]
            var node = pathSections[0][0];

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

        _getEntityFromHeirarchy: function(entityHeirarchy) {
            if (!this.animComponent.entity.name === entityHeirarchy[0])
                return null;

            var currEntity = this.animComponent.entity;
            for (var i = 0; i < entityHeirarchy.length - 1; i++) {
                var entityChildren = currEntity.getChildren();
                var child;
                for (var j = 0; j < entityChildren.length; j++) {
                    if (entityChildren[j].name === entityHeirarchy[i+1])
                        child = entityChildren[j];
                }
                if (child)
                    currEntity = child;
                else
                    return null;
            }
            return currEntity;
        },

        _floatSetter: function(propertyComponent, propertyHeirarchy) {
            var setter = function(values) {
                this._setProperty(propertyComponent, propertyHeirarchy, values[0]);
            };
            return setter.bind(this);
        },
        _booleanSetter: function(propertyComponent, propertyHeirarchy) {
            var setter = function(values) {
                this._setProperty(propertyComponent, propertyHeirarchy, !!values[0]);
            };
            return setter.bind(this);
        },
        _colorSetter: function(propertyComponent, propertyHeirarchy) {
            var colorKeys = ['r', 'g', 'b', 'a'];
            var setter = function(values) {
                for (var i = 0; i < values.length; i++) {
                    this._setProperty(propertyComponent, propertyHeirarchy.concat(colorKeys[i]), values[i]);
                }
            };
            return setter.bind(this);
        },
        _vecSetter: function(propertyComponent, propertyHeirarchy) {
            var vectorKeys = ['x', 'y', 'z', 'w'];
            var setter = function(values) {
                for (var i = 0; i < values.length; i++) {
                    this._setProperty(propertyComponent, propertyHeirarchy.concat(vectorKeys[i]), values[i]);
                }
            };
            return setter.bind(this);
        },

        _getProperty: function(propertyComponent, propertyHeirarchy) {
            if (propertyHeirarchy.length === 1) {
                return propertyComponent[propertyHeirarchy[0]];
            } else {
                var propertyObject = propertyComponent[propertyHeirarchy[0]];
                return propertyObject[propertyHeirarchy[1]];
            }
        },

        _setProperty: function(propertyComponent, propertyHeirarchy, value) {
            if (propertyHeirarchy.length === 1) {
                propertyComponent[propertyHeirarchy[0]] = value;
            } else {
                var propertyObject = propertyComponent[propertyHeirarchy[0]];
                propertyObject[propertyHeirarchy[1]] = value;
                propertyComponent[propertyHeirarchy[0]] = propertyObject;
            }
        },

        _getObjectPropertyType: function(property) {
            if (!property.constructor)
                return undefined;
            
            return property.constructor.name;
        },

        _getEntityProperty: function(propertyHeirarchy) {
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
                if (propertyHeirarchy.indexOf(entityProperties[i]) !== -1) {
                    entityProperty = entityProperties[i];
                }
            }
            return entityProperty;
        },

        _createAnimTargetForProperty: function(propertyComponent, propertyHeirarchy) {

            var property = this._getProperty(propertyComponent, propertyHeirarchy);

            if (typeof property === 'undefined')
                return null;

            var setter;
            var animDataType;
            var animDataComponents;

            if (typeof property === 'number') {
                setter = this._floatSetter(propertyComponent, propertyHeirarchy);
                animDataType = 'vector';
                animDataComponents = 1;
            }
            else if (typeof property === 'boolean') {
                setter = this._booleanSetter(propertyComponent, propertyHeirarchy);
                animDataType = 'vector';
                animDataComponents = 1;
            }
            else if (typeof property === 'object') {
                switch (this._getObjectPropertyType(property)) {
                    case 'Vec2':
                        setter = this._vecSetter(propertyComponent, propertyHeirarchy);
                        animDataType = 'vector';
                        animDataComponents = 2;
                        break;
                    case 'Vec3':
                        setter = this._vecSetter(propertyComponent, propertyHeirarchy);
                        animDataType = 'vector';
                        animDataComponents = 3;
                        break;
                    case 'Vec4':
                        setter = this._vecSetter(propertyComponent, propertyHeirarchy);
                        animDataType = 'vector';
                        animDataComponents = 4;
                        break;
                    case 'Color':
                        setter = this._colorSetter(propertyComponent, propertyHeirarchy);
                        animDataType = 'vector';
                        animDataComponents = 4;
                        break;
                    case 'Quat':
                        setter = this._vecSetter(propertyComponent, propertyHeirarchy);
                        animDataType = 'quaternion';
                        animDataComponents = 4;
                        break;
                    default:
                        return null;
                }
            }

            // for entity properties we cannot just set their values, we must also call the values setter function.
            var entityProperty = this._getEntityProperty(propertyHeirarchy);
            if (entityProperty) {
                var entityPropertySetter = function(values) {
                    // first set new values on the property as before
                    setter(values);

                    // create the function name of the entity properties setter
                    var entityPropertySetterFunctionName = pc.string.format(
                        'set{0}{1}',
                        entityProperty.substring(0,1).toUpperCase(),
                        entityProperty.substring(1)
                    );
                    // call the setter function for entities updated property using the newly set property value
                    propertyComponent[entityPropertySetterFunctionName](this._getProperty(propertyComponent, [entityProperty]));
                };
                return new pc.AnimTarget(entityPropertySetter.bind(this), animDataType, animDataComponents);
            } else {
                return new pc.AnimTarget(setter, animDataType, animDataComponents);
            }
        }
    });

    return {
        AnimComponentBinder: AnimComponentBinder
    };
}());
