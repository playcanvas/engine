import { GraphNode } from '../../../scene/graph-node.js';
import { Model } from '../../../scene/model.js';
import { Trigger } from './trigger.js';

// Collision system implementations
class CollisionSystemImpl {
    constructor(system) {
        this.system = system;
    }

    // Called before the call to system.super.initializeComponentData is made
    beforeInitialize(component) {
        component.shape = null;

        component.model = new Model();
        component.model.graph = new GraphNode();
    }

    // Called after the call to system.super.initializeComponentData is made
    afterInitialize(component) {
        this.recreatePhysicalShapes(component);
        component.initialized = true;
    }

    // Called when a collision component changes type in order to recreate debug and physical shapes
    reset(component) {
        this.beforeInitialize(component);
        this.afterInitialize(component);
    }

    // Re-creates rigid bodies / triggers
    recreatePhysicalShapes(component) {
        const entity = component.entity;

        if (typeof Ammo !== 'undefined') {
            if (entity.trigger) {
                entity.trigger.destroy();
                delete entity.trigger;
            }

            const parentComponent = component._compoundParent;

            if (component.shape) {
                if (parentComponent) {
                    this.system._removeCompoundChild(parentComponent, component.shape);

                    if (parentComponent.entity.rigidbody)
                        parentComponent.entity.rigidbody.activate();
                }

                Ammo.destroy(component.shape);
                component.shape = null;
            }

            component.shape = this.createPhysicalShape(entity);

            const firstCompoundChild = !component._compoundParent;

            if (component.type === 'compound' && (!component._compoundParent || component === component._compoundParent)) {
                component._compoundParent = component;

                entity.forEach(this._addEachDescendant, component);
            } else if (component.type !== 'compound') {
                if (component._compoundParent && component === component._compoundParent) {
                    entity.forEach(this.system.implementations.compound._updateEachDescendant, component);
                }

                if (!component.rigidbody) {
                    component._compoundParent = null;
                    let parent = entity.parent;
                    while (parent) {
                        if (parent.collision && parent.collision.type === 'compound') {
                            component._compoundParent = parent.collision;
                            break;
                        }
                        parent = parent.parent;
                    }
                }
            }

            if (component._compoundParent) {
                if (component !== component._compoundParent) {
                    if (firstCompoundChild && component._compoundParent.shape.getNumChildShapes() === 0) {
                        this.system.recreatePhysicalShapes(component._compoundParent);
                    } else {
                        this.system.updateCompoundChildTransform(entity);

                        if (component._compoundParent.entity.rigidbody)
                            component._compoundParent.entity.rigidbody.activate();
                    }
                }
            }

            if (entity.rigidbody) {
                entity.rigidbody.disableSimulation();
                entity.rigidbody.createBody();

                if (entity.enabled && entity.rigidbody.enabled) {
                    entity.rigidbody.enableSimulation();
                }
            } else if (!component._compoundParent) {
                if (!entity.trigger) {
                    entity.trigger = new Trigger(this.system.app, component);
                } else {
                    entity.trigger.initialize(component);
                }
            }
        }
    }

    // Creates a physical shape for the collision. This consists
    // of the actual shape that will be used for the rigid bodies / triggers of
    // the collision.
    createPhysicalShape(entity) {
        return undefined;
    }

    updateTransform(component, position, rotation, scale) {
        if (component.entity.trigger) {
            component.entity.trigger.updateTransform();
        }
    }

    beforeRemove(component) {
        if (component.shape) {
            if (component._compoundParent && !component._compoundParent.entity._destroying) {
                this.system._removeCompoundChild(component._compoundParent, component.shape);

                if (component._compoundParent.entity.rigidbody)
                    component._compoundParent.entity.rigidbody.activate();
            }

            component._compoundParent = null;

            Ammo.destroy(component.shape);
            component.shape = null;
        }
    }

    // Called when the collision is removed
    remove(entity) {
        if (entity.rigidbody && entity.rigidbody.body) {
            entity.rigidbody.disableSimulation();
        }

        if (entity.trigger) {
            entity.trigger.destroy();
            delete entity.trigger;
        }
    }

    // Called when the collision is cloned to another entity
    clone(entity, clone) {
        const component = entity.collision;
        const data = {
            enabled: component.enabled,
            type: component.type,
            halfExtents: [component.halfExtents.x, component.halfExtents.y, component.halfExtents.z],
            radius: component.radius,
            axis: component.axis,
            height: component.height,
            asset: component.asset,
            renderAsset: component.renderAsset,
            model: component.model,
            render: component.render
        };

        return this.system.addComponent(clone, data);
    }
}

export { CollisionSystemImpl };
