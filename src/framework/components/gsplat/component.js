import { LAYERID_WORLD } from '../../../scene/constants.js';
import { Asset } from '../../asset/asset.js';
import { AssetReference } from '../../asset/asset-reference.js';
import { Component } from '../component.js';

/**
 * The GSplatComponent enables an {@link Entity} to render 3D Gaussian Splats. Splats are always
 * loaded from {@link Asset}s rather than being created programmatically. The asset type is
 * `gsplat` which are in the `.ply` file format.
 *
 * Relevant examples:
 *
 * - [Loading a Splat](https://playcanvas.github.io/#/loaders/gsplat)
 * - [Custom Splat Shaders](https://playcanvas.github.io/#/loaders/gsplat-many)
 *
 * @category Graphics
 */
class GSplatComponent extends Component {
    /** @private */
    _layers = [LAYERID_WORLD]; // assign to the default world layer

    /**
     * @type {import('../../../scene/gsplat/gsplat-instance.js').GSplatInstance|null}
     * @private
     */
    _instance = null;

    /**
     * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
     * @private
     */
    _customAabb = null;

    /**
     * @type {AssetReference}
     * @private
     */
    _assetReference;

    /**
     * @type {import('../../../scene/gsplat/gsplat-material.js').SplatMaterialOptions|null}
     * @private
     */
    _materialOptions = null;

    /**
     * Create a new GSplatComponent.
     *
     * @param {import('./system.js').GSplatComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        // gsplat asset reference
        this._assetReference = new AssetReference(
            'asset',
            this,
            system.app.assets, {
                add: this._onGSplatAssetAdded,
                load: this._onGSplatAssetLoad,
                remove: this._onGSplatAssetRemove,
                unload: this._onGSplatAssetUnload
            },
            this
        );

        // handle events when the entity is directly (or indirectly as a child of sub-hierarchy)
        // added or removed from the parent
        entity.on('remove', this.onRemoveChild, this);
        entity.on('removehierarchy', this.onRemoveChild, this);
        entity.on('insert', this.onInsertChild, this);
        entity.on('inserthierarchy', this.onInsertChild, this);
    }

    /**
     * Sets a custom object space bounding box for visibility culling of the attached gsplat.
     *
     * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
     */
    set customAabb(value) {
        this._customAabb = value;

        // set it on meshInstance
        this._instance?.meshInstance?.setCustomAabb(this._customAabb);
    }

    /**
     * Gets the custom object space bounding box for visibility culling of the attached gsplat.
     *
     * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
     */
    get customAabb() {
        return this._customAabb;
    }

    /**
     * Sets a {@link GSplatInstance} on the component. If not set or loaded, it returns null.
     *
     * @type {import('../../../scene/gsplat/gsplat-instance.js').GSplatInstance|null}
     * @ignore
     */
    set instance(value) {

        // destroy existing instance
        this.destroyInstance();

        this._instance = value;

        if (this._instance?.meshInstance) {

            // if mesh instance was created without a node, assign it here
            const mi = this._instance.meshInstance;
            if (!mi.node) {
                mi.node = this.entity;
            }

            mi.setCustomAabb(this._customAabb);

            // if we have custom shader options, apply them
            if (this._materialOptions) {
                this._instance.createMaterial(this._materialOptions);
            }

            if (this.enabled && this.entity.enabled) {
                this.addToLayers();
            }
        }
    }

    /**
     * Gets the {@link GSplatInstance} on the component.
     *
     * @type {import('../../../scene/gsplat/gsplat-instance.js').GSplatInstance|null}
     * @ignore
     */
    get instance() {
        return this._instance;
    }

    set materialOptions(value) {
        this._materialOptions = Object.assign({}, value);

        // apply them on the instance if it exists
        if (this._instance) {
            this._instance.createMaterial(this._materialOptions);
        }
    }

    get materialOptions() {
        return this._materialOptions;
    }

    /**
     * Gets the material used to render the gsplat.
     *
     * @type {import('../../../scene/materials/material.js').Material|undefined}
     */
    get material() {
        return this._instance?.material;
    }

    /**
     * Sets an array of layer IDs ({@link Layer#id}) to which this gsplat should belong. Don't
     * push, pop, splice or modify this array. If you want to change it, set a new one instead.
     *
     * @type {number[]}
     */
    set layers(value) {

        // remove the mesh instances from old layers
        this.removeFromLayers();

        // set the layer list
        this._layers.length = 0;
        for (let i = 0; i < value.length; i++) {
            this._layers[i] = value[i];
        }

        // don't add into layers until we're enabled
        if (!this.enabled || !this.entity.enabled)
            return;

        // add the mesh instance to new layers
        this.addToLayers();
    }

    /**
     * Gets the array of layer IDs ({@link Layer#id}) to which this gsplat belongs.
     *
     * @type {number[]}
     */
    get layers() {
        return this._layers;
    }

    /**
     * Sets the gsplat asset for this gsplat component. Can also be an asset id.
     *
     * @type {Asset|number}
     */
    set asset(value) {

        const id = value instanceof Asset ? value.id : value;
        if (this._assetReference.id === id) return;

        if (this._assetReference.asset && this._assetReference.asset.resource) {
            this._onGSplatAssetRemove();
        }

        this._assetReference.id = id;

        if (this._assetReference.asset) {
            this._onGSplatAssetAdded();
        }
    }

    /**
     * Gets the gsplat asset id for this gsplat component.
     *
     * @type {Asset|number}
     */
    get asset() {
        return this._assetReference.id;
    }

    /**
     * Assign asset id to the component, without updating the component with the new asset.
     * This can be used to assign the asset id to already fully created component.
     *
     * @param {Asset|number} asset - The gsplat asset or asset id to assign.
     * @ignore
     */
    assignAsset(asset) {
        const id = asset instanceof Asset ? asset.id : asset;
        this._assetReference.id = id;
    }

    /** @private */
    destroyInstance() {
        if (this._instance) {
            this.removeFromLayers();
            this._instance?.destroy();
            this._instance = null;
        }
    }

    /** @private */
    addToLayers() {
        const meshInstance = this.instance?.meshInstance;
        if (meshInstance) {
            const layers = this.system.app.scene.layers;
            for (let i = 0; i < this._layers.length; i++) {
                layers.getLayerById(this._layers[i])?.addMeshInstances([meshInstance]);
            }
        }
    }

    removeFromLayers() {
        const meshInstance = this.instance?.meshInstance;
        if (meshInstance) {
            const layers = this.system.app.scene.layers;
            for (let i = 0; i < this._layers.length; i++) {
                layers.getLayerById(this._layers[i])?.removeMeshInstances([meshInstance]);
            }
        }
    }

    /** @private */
    onRemoveChild() {
        this.removeFromLayers();
    }

    /** @private */
    onInsertChild() {
        if (this._instance && this.enabled && this.entity.enabled) {
            this.addToLayers();
        }
    }

    onRemove() {
        this.destroyInstance();

        this.asset = null;
        this._assetReference.id = null;

        this.entity.off('remove', this.onRemoveChild, this);
        this.entity.off('insert', this.onInsertChild, this);
    }

    onLayersChanged(oldComp, newComp) {
        this.addToLayers();
        oldComp.off('add', this.onLayerAdded, this);
        oldComp.off('remove', this.onLayerRemoved, this);
        newComp.on('add', this.onLayerAdded, this);
        newComp.on('remove', this.onLayerRemoved, this);
    }

    onLayerAdded(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        if (this._instance) {
            layer.addMeshInstances(this._instance.meshInstance);
        }
    }

    onLayerRemoved(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        if (this._instance) {
            layer.removeMeshInstances(this._instance.meshInstance);
        }
    }

    onEnable() {
        const scene = this.system.app.scene;
        scene.on('set:layers', this.onLayersChanged, this);
        if (scene.layers) {
            scene.layers.on('add', this.onLayerAdded, this);
            scene.layers.on('remove', this.onLayerRemoved, this);
        }

        if (this._instance) {
            this.addToLayers();
        } else if (this.asset) {
            this._onGSplatAssetAdded();
        }
    }

    onDisable() {
        const scene = this.system.app.scene;
        scene.off('set:layers', this.onLayersChanged, this);
        if (scene.layers) {
            scene.layers.off('add', this.onLayerAdded, this);
            scene.layers.off('remove', this.onLayerRemoved, this);
        }

        this.removeFromLayers();
    }

    /**
     * Stop rendering this component without removing its mesh instance from the scene hierarchy.
     */
    hide() {
        if (this._instance) {
            this._instance.meshInstance.visible = false;
        }
    }

    /**
     * Enable rendering of the component if hidden using {@link GSplatComponent#hide}.
     */
    show() {
        if (this._instance) {
            this._instance.meshInstance.visible = true;
        }
    }

    _onGSplatAssetAdded() {
        if (!this._assetReference.asset)
            return;

        if (this._assetReference.asset.resource) {
            this._onGSplatAssetLoad();
        } else if (this.enabled && this.entity.enabled) {
            this.system.app.assets.load(this._assetReference.asset);
        }
    }

    _onGSplatAssetLoad() {

        // remove existing instance
        this.destroyInstance();

        // create new instance
        const asset = this._assetReference.asset;
        if (asset) {
            this.instance = asset.resource.createInstance();
        }
    }

    _onGSplatAssetUnload() {
        // when unloading asset, only remove the instance
        this.destroyInstance();
    }

    _onGSplatAssetRemove() {
        this._onGSplatAssetUnload();
    }
}

export { GSplatComponent };
