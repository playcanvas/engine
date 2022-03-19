import { CollisionSystemImpl } from '../implementation.js';

import { SEMANTIC_POSITION } from '../../../../graphics/constants.js';
import { GraphNode } from '../../../../scene/graph-node.js';

import { Trigger } from '../trigger.js';

const tempGraphNode = new GraphNode();

// Mesh Collision System
class CollisionMeshSystemImpl extends CollisionSystemImpl {
    // override for the mesh implementation because the asset model needs
    // special handling
    beforeInitialize(component) {}

    createAmmoMesh(mesh, node, shape) {
        let triMesh;

        if (this.system.triMeshCache[mesh.id]) {
            triMesh = this.system.triMeshCache[mesh.id];
        } else {
            const vb = mesh.vertexBuffer;

            const format = vb.getFormat();
            let stride;
            let positions;
            for (let i = 0; i < format.elements.length; i++) {
                const element = format.elements[i];
                if (element.name === SEMANTIC_POSITION) {
                    positions = new Float32Array(vb.lock(), element.offset);
                    stride = element.stride / 4;
                    break;
                }
            }

            const indices = [];
            mesh.getIndices(indices);
            const numTriangles = mesh.primitive[0].count / 3;

            const v1 = new Ammo.btVector3();
            const v2 = new Ammo.btVector3();
            const v3 = new Ammo.btVector3();
            let i1, i2, i3;

            const base = mesh.primitive[0].base;
            triMesh = new Ammo.btTriangleMesh();
            this.system.triMeshCache[mesh.id] = triMesh;

            for (let i = 0; i < numTriangles; i++) {
                i1 = indices[base + i * 3] * stride;
                i2 = indices[base + i * 3 + 1] * stride;
                i3 = indices[base + i * 3 + 2] * stride;
                v1.setValue(positions[i1], positions[i1 + 1], positions[i1 + 2]);
                v2.setValue(positions[i2], positions[i2 + 1], positions[i2 + 2]);
                v3.setValue(positions[i3], positions[i3 + 1], positions[i3 + 2]);
                triMesh.addTriangle(v1, v2, v3, true);
            }

            Ammo.destroy(v1);
            Ammo.destroy(v2);
            Ammo.destroy(v3);
        }

        const useQuantizedAabbCompression = true;
        const triMeshShape = new Ammo.btBvhTriangleMeshShape(triMesh, useQuantizedAabbCompression);

        const scaling = this.system._getNodeScaling(node);
        triMeshShape.setLocalScaling(scaling);
        Ammo.destroy(scaling);

        const transform = this.system._getNodeTransform(node);
        shape.addChildShape(transform, triMeshShape);
        Ammo.destroy(transform);
    }

    createPhysicalShape(entity) {
        if (typeof Ammo === 'undefined') return;

        const component = entity.collision;

        if (component.model || component.render) {

            const shape = new Ammo.btCompoundShape();

            if (component.model) {
                const meshInstances = component.model.meshInstances;
                for (let i = 0; i < meshInstances.length; i++) {
                    this.createAmmoMesh(meshInstances[i].mesh, meshInstances[i].node, shape);
                }
            } else if (component.render) {
                const meshes = component.render.meshes;
                for (let i = 0; i < meshes.length; i++) {
                    this.createAmmoMesh(meshes[i], tempGraphNode, shape);
                }
            }

            const entityTransform = entity.getWorldTransform();
            const scale = entityTransform.getScale();
            const vec = new Ammo.btVector3(scale.x, scale.y, scale.z);
            shape.setLocalScaling(vec);
            Ammo.destroy(vec);

            return shape;
        }
    }

    recreatePhysicalShapes(component) {
        const asset = component.renderAsset || component.asset;

        if (asset && component.enabled && component.entity.enabled) {
            this.loadAsset(
                component,
                asset,
                component.renderAsset ? 'render' : 'model'
            );
            return;
        }

        this.doRecreatePhysicalShape(component);
    }

    loadAsset(component, id, property) {
        const assets = this.system.app.assets;

        const asset = assets.get(id);
        if (asset) {
            asset.ready((asset) => {
                component[property] = asset.resource;
                this.doRecreatePhysicalShape(component);
            });
            assets.load(asset);
        } else {
            assets.once("add:" + id, (asset) => {
                asset.ready((asset) => {
                    component[property] = asset.resource;
                    this.doRecreatePhysicalShape(component);
                });
                assets.load(asset);
            });
        }
    }

    doRecreatePhysicalShape(component) {
        const entity = component.entity;

        if (component.model || component.render) {
            this.destroyShape(component);

            component.shape = this.createPhysicalShape(entity);

            if (entity.rigidbody) {
                entity.rigidbody.disableSimulation();
                entity.rigidbody.createBody();

                if (entity.enabled && entity.rigidbody.enabled) {
                    entity.rigidbody.enableSimulation();
                }
            } else {
                if (!entity.trigger) {
                    entity.trigger = new Trigger(this.system.app, component);
                } else {
                    entity.trigger.initialize(component);
                }
            }
        } else {
            this.beforeRemove(component);
            this.remove(entity);
        }
    }

    updateTransform(component, position, rotation, scale) {
        if (component.shape) {
            const entityTransform = component.entity.getWorldTransform();
            const worldScale = entityTransform.getScale();

            // if the scale changed then recreate the shape
            const previousScale = component.shape.getLocalScaling();
            if (worldScale.x !== previousScale.x() ||
                worldScale.y !== previousScale.y() ||
                worldScale.z !== previousScale.z()) {
                this.doRecreatePhysicalShape(component);
            }
        }

        super.updateTransform(component, position, rotation, scale);
    }

    destroyShape(component) {
        if (!component.shape)
            return;

        const numShapes = component.shape.getNumChildShapes();
        for (let i = 0; i < numShapes; i++) {
            const shape = component.shape.getChildShape(i);
            Ammo.destroy(shape);
        }

        Ammo.destroy(component.shape);
        component.shape = null;
    }

    remove(entity) {
        this.destroyShape(entity.collision);
        super.remove(entity);
    }
}

export { CollisionMeshSystemImpl };
