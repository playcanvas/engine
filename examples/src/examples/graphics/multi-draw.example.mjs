// @config DESCRIPTION Terrain rendering using a single draw call built from a grid of displaced planes. Each patch is a sub-draw and can be culled (hidden) dynamically.
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const assets = {
    helipad: new pc.Asset(
        'helipad-env-atlas',
        'texture',
        { url: `${rootPath}/static/assets/cubemaps/table-mountain-env-atlas.png` },
        { type: pc.TEXTURETYPE_RGBP, mipmaps: false }
    ),
    height: new pc.Asset(
        'height',
        'texture',
        { url: `${rootPath}/static/assets/textures/terrain/Canyon-Height.jpg` }
    ),
    diffuse: new pc.Asset(
        'diffuse',
        'texture',
        { url: `${rootPath}/static/assets/textures/terrain/Canyon-Diffuse.jpg` }
    )
};

const gfxOptions = {
    deviceTypes: [deviceType],
    glslangUrl: `${rootPath}/static/lib/glslang/glslang.js`,
    twgslUrl: `${rootPath}/static/lib/twgsl/twgsl.js`
};

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.ScriptComponentSystem];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ScriptHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // setup skydome
    app.scene.skyboxMip = 2;
    app.scene.exposure = 1;
    app.scene.envAtlas = assets.helipad.resource;
    app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

    // camera
    const camera = new pc.Entity();
    camera.addComponent('camera', { toneMapping: pc.TONEMAP_ACES });
    camera.addComponent('script');
    app.root.addChild(camera);
    camera.translate(0, 150, 80);
    camera.lookAt(pc.Vec3.ZERO);
    const cc = /** @type { any } */ (camera.script.create(CameraControls));
    Object.assign(cc, {
        // focusPoint: pc.Vec3.ZERO,
        enableFly: false
    });

    // material
    const material = new pc.StandardMaterial();
    material.diffuseMap = assets.diffuse.resource;
    material.update();

    // terrain params
    const terrainWidth = 120;
    const terrainDepth = 120;
    const minHeight = -50;
    const maxHeight = 50;
    const patchesX = 40;
    const patchesZ = 40;
    const patchSegments = 32; // segments per side for each patch (increased detail)

    // heightmap buffer
    const img = assets.height.resource.getSource();
    const bufferWidth = img.width;
    const bufferHeight = img.height;
    const canvas2d = document.createElement('canvas');
    canvas2d.width = bufferWidth;
    canvas2d.height = bufferHeight;
    const ctx = canvas2d.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const buffer = ctx.getImageData(0, 0, bufferWidth, bufferHeight).data;

    // reusable patch geometry (unit patch centered on origin with given size/segments)
    const patchWidth = terrainWidth / patchesX;
    const patchDepth = terrainDepth / patchesZ;
    const patchGeom = new pc.PlaneGeometry({
        halfExtents: new pc.Vec2(patchWidth * 0.5, patchDepth * 0.5),
        widthSegments: patchSegments,
        lengthSegments: patchSegments
    });

    // combined buffers
    const positions = [];
    const uvs = [];
    const indices = [];

    // per-patch draw info
    const firstIndexPerPatch = [];
    const indexCountPerPatch = [];

    // helper to sample height from global (x,z) in world units, stored in R channel of heightmap
    const sampleHeight = (x, z) => {
        const u = (x + terrainWidth * 0.5) / terrainWidth;
        const v = 1 - (z + terrainDepth * 0.5) / terrainDepth;
        const ix = Math.max(0, Math.min(bufferWidth - 1, (u * (bufferWidth - 1)) | 0));
        const iy = Math.max(0, Math.min(bufferHeight - 1, (v * (bufferHeight - 1)) | 0));
        const p = (ix + iy * bufferWidth) * 4;
        const r = buffer[p] / 255;
        return minHeight + (maxHeight - minHeight) * r;
    };

    // build combined mesh from grid of patches
    let vertexBase = 0;
    for (let pz = 0; pz < patchesZ; pz++) {
        for (let px = 0; px < patchesX; px++) {
            const centerX = -terrainWidth * 0.5 + (px + 0.5) * patchWidth;
            const centerZ = -terrainDepth * 0.5 + (pz + 0.5) * patchDepth;

            // record first index for this patch
            firstIndexPerPatch.push(indices.length);

            // positions, uvs
            const srcPos = patchGeom.positions;
            for (let i = 0; i < srcPos.length; i += 3) {
                const lx = srcPos[i + 0];
                const lz = srcPos[i + 2];
                const wx = lx + centerX;
                const wz = lz + centerZ;
                const wy = sampleHeight(wx, wz);
                positions.push(wx, wy, wz);
                uvs.push((wx + terrainWidth * 0.5) / terrainWidth, 1 - (wz + terrainDepth * 0.5) / terrainDepth);
            }

            // indices
            const srcIdx = patchGeom.indices;
            for (let i = 0; i < srcIdx.length; i++) {
                indices.push(vertexBase + srcIdx[i]);
            }

            indexCountPerPatch.push(srcIdx.length);
            vertexBase += srcPos.length / 3;
        }
    }

    // normals after displacement
    const normals = pc.calculateNormals(positions, indices);

    // create a single mesh from all patches
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(positions);
    mesh.setNormals(normals);
    mesh.setUvs(0, uvs);
    mesh.setIndices(indices);
    mesh.update();

    // MeshInstance
    const meshInst = new pc.MeshInstance(mesh, material);

    // entity to render our MeshInstance
    const entity = new pc.Entity('TerrainEntity');
    entity.addComponent('render', { meshInstances: [meshInst] });
    app.root.addChild(entity);

    // allocater multi-draw: one sub-draw per patch
    const numPatches = patchesX * patchesZ;
    const cmd = meshInst.setMultiDraw(null, numPatches);

    const bandRadius = 1;          // half-width in grid units (~2-entry band)
    const rotRps = 0.1;            // revolutions per second for spinning line
    let time = 0;

    app.on('update', (dt) => {
        time += dt;
        // spinning band: infinite line through grid center with angle theta; hide patches within distance <= bandRadius
        const cx = (patchesX - 1) * 0.5;
        const cz = (patchesZ - 1) * 0.5;
        const theta = time * rotRps * Math.PI * 2;
        const s = Math.sin(theta);
        const c = Math.cos(theta);

        // repack visible draws into the front of the arrays, hiding patches within diagonal band
        let write = 0;
        for (let pz = 0; pz < patchesZ; pz++) {
            for (let px = 0; px < patchesX; px++) {
                // perpendicular distance in grid units to line through (cx,cz) at angle theta
                const dx = px - cx;
                const dz = pz - cz;
                const dist = Math.abs(dx * s - dz * c);
                if (dist <= bandRadius) continue; // hidden by sweeping band
                const idx = pz * patchesX + px;
                cmd.add(write, indexCountPerPatch[idx], 1, firstIndexPerPatch[idx], 0, 0);
                write++;
            }
        }
        cmd.update(write);
    });
});

export { app };
