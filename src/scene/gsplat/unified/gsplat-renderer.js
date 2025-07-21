import { SEMANTIC_POSITION, SEMANTIC_ATTR13, CULLFACE_NONE } from '../../../platform/graphics/constants.js';
import { BLEND_NONE, BLEND_PREMULTIPLIED } from '../../constants.js';
import { ShaderMaterial } from '../../materials/shader-material.js';
import { MeshInstance } from '../../mesh-instance.js';
import { GSplatResourceBase } from '../gsplat-resource-base.js';

const viewport = [0, 0];

class GSplatRenderer {
    /** @type {ShaderMaterial} */
    _material;

    /** @type {MeshInstance} */
    meshInstance;

    constructor(device, node, workBuffer, app) {
        this.device = device;
        this.node = node;
        this.workBuffer = workBuffer;
        this.app = app;

        // construct the material which renders the splats from the work buffer
        this._material = new ShaderMaterial({
            uniqueName: 'UnifiedSplatMaterial',
            vertexGLSL: '#include "gsplatVS"',
            fragmentGLSL: '#include "gsplatPS"',
            vertexWGSL: '#include "gsplatVS"',
            fragmentWGSL: '#include "gsplatPS"',
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_id_attrib: SEMANTIC_ATTR13
            }
        });

        // input format
        this._material.setDefine('GSPLAT_WORKBUFFER_DATA', true);

        // input textures (work buffer textures)
        this._material.setParameter('splatColor', workBuffer.colorTexture);
        this._material.setParameter('covA', workBuffer.covATexture);
        this._material.setParameter('covB', workBuffer.covBTexture);
        this._material.setParameter('center', workBuffer.centerTexture);
        this._material.setDefine('SH_BANDS', '0');

        // set instance properties
        const dither = false;
        this._material.setParameter('numSplats', 0);
        this._material.setParameter('splatOrder', workBuffer.orderTexture);
        this._material.setParameter('alphaClip', 0.3);
        this._material.setDefine(`DITHER_${dither ? 'BLUENOISE' : 'NONE'}`, '');
        this._material.cull = CULLFACE_NONE;
        this._material.blendType = dither ? BLEND_NONE : BLEND_PREMULTIPLIED;
        this._material.depthWrite = !!dither;
        this._material.update();

        this.createMeshInstance();
    }

    destroy() {
        this._material.destroy();
        this.meshInstance.destroy();
    }

    createMeshInstance() {


        const worldLayer = this.app.scene.layers.getLayerByName('World');

        if (this.meshInstance) {
            worldLayer.removeMeshInstances([this.meshInstance]);
            this.meshInstance.destroy();
        }

        const numSplats = this.workBuffer.width * this.workBuffer.height;
        const mesh = GSplatResourceBase.createMesh(this.device, numSplats);
        const instanceIndices = GSplatResourceBase.createInstanceIndices(this.device, numSplats);
        this.meshInstance = new MeshInstance(mesh, this._material);
        this.meshInstance.node = this.node;
        this.meshInstance.setInstancing(instanceIndices, true);

        // TODO: is this the best option, or do we want to generate AABB
        // - ideally generate aabb from individual splats, update each frame
        this.meshInstance.cull = false;

        // only start rendering the splat after we've received the splat order data
        this.meshInstance.instancingCount = 0;


        worldLayer.addMeshInstances([this.meshInstance]);
    }

    updateViewport(cameraNode) {
        const camera = cameraNode?.camera;
        const renderTarget = camera?.renderTarget;
        const { width, height } = renderTarget ?? this.device;

        viewport[0] = width;
        viewport[1] = height;

        // adjust viewport for stereoscopic VR sessions
        const xr = camera?.camera?.xr;
        if (xr?.active && xr.views.list.length === 2) {
            viewport[0] *= 0.5;
        }

        this._material.setParameter('viewport', viewport);
    }
}

export { GSplatRenderer };
