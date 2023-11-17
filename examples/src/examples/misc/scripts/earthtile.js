import { TileManager } from 'https://esm.sh/earthatile@1.0.0'
import * as pcui from 'https://esm.sh/@playcanvas/pcui'
import 'https://esm.sh/@playcanvas/pcui/styles';

export const attributes = {
    apiUrl: { type: 'string', default: 'https://tile.googleapis.com/' },
    camera: { type: 'entity' }
};

export default class TileRenderer extends pc.EsmScriptType {
    loadGlb(url) {
        return new Promise((resolve, reject) => {
            const filename = new URL(url).pathname.split("/").pop();

            const asset = new pc.Asset(filename, 'container', {
                url: url
            }, null, {
                image: {
                    postprocess: (gltfImage, textureAsset) => {
                        // max anisotropy on all textures
                        textureAsset.resource.anisotropy = this.app.graphicsDevice.maxAnisotropy;
                    }
                }
            });
            asset.once('load', function (containerAsset) {
                resolve(containerAsset);
            });
            asset.once('error', function (err) {
                reject(err);
            });

            this.app.assets.add(asset);
            this.app.assets.load(asset);
        });
    }

    // initialize code called once per entity
    initialize() {
        this.selectedNode = null;

        const key = localStorage.getItem('tiles-api-key');

        const style = document.createElement('style');
        style.textContent = `
        .pcui-label {
            font-size: 12px;
        }

        .pcui-overlay-content {
            padding: 8px;
            z-index: 0;
        }`;
        document.head.appendChild(style);

        const overlay = new pcui.Overlay({
            clickable: false,
            transparent: false
        });
        document.body.appendChild(overlay.dom);

        const textInput = new pcui.TextInput({
            value: key
        });
        const group = new pcui.LabelGroup({
            field: textInput,
            text: 'API key:'
        });
        overlay.append(group);

        const button = new pcui.Button({
            enabled: true,
            text: 'OK'
        });
        button.style.float = 'right';
        button.on('click', () => {
            localStorage.setItem('tiles-api-key', textInput.value);
            overlay.hidden = true;
            this.start(textInput.value);
        });
        overlay.append(button);

        textInput.on('change', (value) => {
            localStorage.setItem('tiles-api-key', textInput.value);
            button.enabled = value.length > 0;
        });
        textInput.focus();
    }

    start(apiKey) {
        this.entity.translate(-3978313.573, -4968706.59, -5293.061); // London

        /** @type {Map<object, pc.Entity} */
        const nodeToEntity = new Map();

        /** @type {Map<object, pc.Asset} */
        const nodeToAsset = new Map();

        /** @type {Map<pc.MeshInstance, object} */
        const meshInstanceToNode = new Map();

        const load = async (node) => {
            const uri = node.content.uri;
            console.log('LOADING: ' + uri);
            const url = `${this.apiUrl}${uri}?key=${apiKey}&session=${this.tileManager.session}`;

            /** @type {pc.Asset} */
            let asset;
            try {
                asset = await this.loadGlb(url);
            } catch (err) {
                console.error("An error occurred while loading the GLB:", err);
            }

            /** @type {pc.ContainerResource} */
            const resource = asset.resource;

            const entity = resource.instantiateRenderEntity({
                castShadows: false
            });
            this.entity.addChild(entity);

            // Update all maps
            for (const meshInstance of entity.render.meshInstances) {
                meshInstanceToNode.set(meshInstance, node);
            }
            nodeToAsset.set(node, asset);
            nodeToEntity.set(node, entity);
        };
        const unload = (node) => {
            console.log('UNLOADING: ' + node.content.uri);

            const entity = nodeToEntity.get(node);
            if (entity) {
                for (const meshInstance of entity.render.meshInstances) {
                    meshInstanceToNode.delete(meshInstance);
                }

                entity.destroy();
                nodeToEntity.delete(node);
            }

            const asset = nodeToAsset.get(node);
            if (asset) {
                asset.unload();
                nodeToAsset.delete(node);
            }
        };
        const show = (node) => {
            console.log('SHOWING: ' + node.content.uri);
            const entity = nodeToEntity.get(node);
            if (entity) {
                entity.render.enabled = true;
            }
        };
        const hide = (node) => {
            console.log('HIDING: ' + node.content.uri);
            const entity = nodeToEntity.get(node);
            if (entity) {
                entity.render.enabled = false;
            }
        };

        this.tileManager = new TileManager(apiKey, this.apiUrl, { load, unload, show, hide });
        this.tileManager.start();

        // Create a picker for debugging tile data
        const canvas = this.app.graphicsDevice.canvas;
        this.picker = new pc.Picker(this.app, canvas.width, canvas.height);
        canvas.addEventListener('click', (e) => {
            if (e.shiftKey) {
                this.picker.prepare(this.camera.camera, this.app.scene);
                const results = this.picker.getSelection(e.clientX, e.clientY);
                this.selectedNode = null;
                for (const meshInstance of results) {
                    this.selectedNode = meshInstanceToNode.get(meshInstance);
                    console.log(this.selectedNode);
                }
            }
        });
    }

    renderBoundingVolume(node) {
        const offset = this.entity.getPosition();

        const boundingVolume = node.boundingVolume;

        // Extract box properties from bounding volume
        const [cx, cy, cz, xx, xy, xz, yx, yy, yz, zx, zy, zz] = boundingVolume.box;

        // Convert the bounding box data into PlayCanvas vectors (adjusting for Z-up to Y-up)
        const center = new pc.Vec3(cx, cz, -cy);
        const xaxis = new pc.Vec3(xx, xz, -xy);
        const yaxis = new pc.Vec3(yx, yz, -yy);
        const zaxis = new pc.Vec3(zx, zz, -zy);

        // Calculate eight vertices of the box
        const vertices = [
            center.clone().sub(xaxis).sub(yaxis).sub(zaxis).add(offset),
            center.clone().add(xaxis).sub(yaxis).sub(zaxis).add(offset),
            center.clone().add(xaxis).add(yaxis).sub(zaxis).add(offset),
            center.clone().sub(xaxis).add(yaxis).sub(zaxis).add(offset),
            center.clone().sub(xaxis).sub(yaxis).add(zaxis).add(offset),
            center.clone().add(xaxis).sub(yaxis).add(zaxis).add(offset),
            center.clone().add(xaxis).add(yaxis).add(zaxis).add(offset),
            center.clone().sub(xaxis).add(yaxis).add(zaxis).add(offset)
        ];

        // Create line segments that connect vertices of the box
        const positions = [
            // Bottom square
            vertices[0], vertices[1],
            vertices[1], vertices[2],
            vertices[2], vertices[3],
            vertices[3], vertices[0],

            // Top square
            vertices[4], vertices[5],
            vertices[5], vertices[6],
            vertices[6], vertices[7],
            vertices[7], vertices[4],

            // Connecting lines
            vertices[0], vertices[4],
            vertices[1], vertices[5],
            vertices[2], vertices[6],
            vertices[3], vertices[7]
        ];

        const colors = [];
        for (let i = 0; i < 24; i++) {
            colors.push(pc.Color.WHITE);
        }

        this.app.drawLines(positions, colors);
    }

    // update code called every frame
    update(dt) {
        if (this.tileManager && this.camera) {
            const pos = this.camera.getPosition();
            const offset = this.entity.getPosition();
            pos.sub(offset);
            this.tileManager.update([pos.x, pos.y, pos.z]);

            if (this.selectedNode) {
                this.renderBoundingVolume(this.selectedNode);
            }
        }
    }
}
