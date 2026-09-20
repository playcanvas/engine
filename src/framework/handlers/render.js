import { Debug } from '../../core/debug.js';
import { Render } from '../../scene/render.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 * @import { Asset } from '../asset/asset.js'
 * @import { EventHandle } from '../../core/event-handle.js'
 * @import { ResourceHandlerCallback } from './handler.js'
 */

/**
 * Resource handler for the `render` asset type. A render asset has no file of its own: it takes
 * the meshes of one glTF mesh from the container asset named in its data and exposes them as a
 * `Render`.
 *
 * @category Asset
 */
class RenderHandler extends ResourceHandler {
    /**
     * @type {WeakMap<Asset, () => void>}
     * @private
     */
    _pendingLoads = new WeakMap();

    /**
     * @type {WeakMap<Asset, () => void>}
     * @private
     */
    _bindings = new WeakMap();

    /**
     * Create a new RenderHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'render');

        this._registry = app.assets;
    }

    /**
     * Waits for a render asset's container to supply its meshes. Without an asset, completes
     * with no render data.
     *
     * @param {string|{load: string, original: string}} url - The resource URL. Not used for
     * container-backed render assets.
     * @param {ResourceHandlerCallback} callback - Called with the container's render data or an error.
     * @param {Asset} [asset] - The render asset whose container dependency should be loaded.
     */
    load(url, callback, asset) {
        if (!asset) {
            callback(null, null);
            return;
        }

        this._pendingLoads.get(asset)?.();

        const registry = this._registry;
        const containerId = asset.data.containerAsset;
        if (!containerId) {
            callback(null, null);
            return;
        }

        /** @type {EventHandle[]} */
        const events = [];
        // Unsubscribing does not remove callbacks from an event dispatch already in progress.
        let active = true;
        const cleanup = () => {
            if (!active) return;
            active = false;
            events.forEach(event => event.off());
            this._pendingLoads.delete(asset);
        };
        const cancel = () => {
            if (!active) return;
            cleanup();
            asset.loading = false;
        };
        const onError = (err) => {
            if (!active) return;
            cleanup();
            callback(err);
        };
        const onLoad = (containerAsset) => {
            if (!active) return;
            const render = containerAsset.resource?.renders?.[asset.data.renderIndex]?.resource;
            if (!render?.meshes) {
                onError(`Render ${asset.data.renderIndex} is unavailable in container asset ${containerId}`);
                return;
            }

            cleanup();
            callback(null, render);
        };
        const onAdd = (containerAsset) => {
            if (!active) return;
            events.push(
                containerAsset.once('load', onLoad),
                containerAsset.once('error', onError),
                containerAsset.once('remove', () => onError(`Container asset ${containerId} was removed`))
            );

            if (containerAsset.resource) {
                onLoad(containerAsset);
            } else if (containerAsset.loaded) {
                onError(`Container asset ${containerId} has no resource`);
            } else {
                registry.load(containerAsset);
            }
        };

        this._pendingLoads.set(asset, cleanup);
        events.push(
            asset.once('unload', cancel),
            asset.once('remove', cancel),
            asset.on('change', (changedAsset, property) => {
                if (active && property === 'data') {
                    cleanup();
                    this.load(url, callback, asset);
                }
            })
        );

        const containerAsset = registry.get(containerId);
        if (containerAsset) {
            onAdd(containerAsset);
        } else {
            Debug.warnOnce(`Render asset '${asset.name}' (${asset.id}) is waiting for container asset ${containerId}, which is not registered yet.`);
            events.push(registry.once(`add:${containerId}`, onAdd));
        }
    }

    open(url, data) {
        const render = new Render();
        if (data instanceof Render) {
            render.meshes = data.meshes;
        }
        return render;
    }

    patch(asset, registry) {
        this._bindings.get(asset)?.();
        if (!asset.data.containerAsset) {
            return;
        }

        /** @type {EventHandle[]} */
        const events = [];
        let active = true;
        const cleanup = () => {
            if (!active) return;
            active = false;
            events.forEach(event => event.off());
            this._bindings.delete(asset);
        };
        const onLoad = (containerAsset) => {
            if (!active) return;
            const render = containerAsset.resource?.renders?.[asset.data.renderIndex]?.resource;
            // Initial loading already assigned the meshes. Only update them when the dependency changes.
            if (asset.resource && render && asset.resource.meshes !== render.meshes) {
                asset.resource.meshes = render.meshes;
            }
        };
        const onAdd = (containerAsset) => {
            if (!active) return;
            events.push(
                registry.on(`load:${containerAsset.id}`, onLoad),
                registry.once(`remove:${containerAsset.id}`, () => {
                    if (!active) return;
                    cleanup();
                    asset.resource?.destroy();
                })
            );
            if (containerAsset.resource) {
                onLoad(containerAsset);
            } else {
                registry.load(containerAsset);
            }
        };

        this._bindings.set(asset, cleanup);
        events.push(asset.once('unload', cleanup), asset.once('remove', cleanup));
        const containerAsset = registry.get(asset.data.containerAsset);
        if (containerAsset) {
            onAdd(containerAsset);
        } else {
            events.push(registry.once(`add:${asset.data.containerAsset}`, onAdd));
        }
    }
}

export { RenderHandler };
