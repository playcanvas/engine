import {
    Script, Texture, math,
    PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, WORKBUFFER_UPDATE_ONCE
} from 'playcanvas';

/**
 * @import { Vec3 } from 'playcanvas'
 */

// tracks which work buffer formats already have the tree stream, so the stream (which cannot be
// removed once added) is only added once per format
const formatsWithStream = new WeakSet();

// hard cap on the per-cell sphere loop in the copy shader (a safety bound only - a splat
// realistically overlaps a handful of trees)
const MAX_CELL_SPHERES = 256;

// --- Copy stage: runs when splats are written to the work buffer (once on load, and again on
// demand when the trees change or during LOD streaming). It finds the tree sphere a splat belongs
// to and bakes a compact RGBA8 "bind" (sway amount, height fraction, and a 16-bit tree index
// packed across B/A) into an extra work buffer stream. To stay cheap with many trees it does not
// loop all spheres: the spheres are bucketed into a uniform XZ grid (built on the CPU) and only
// the spheres in the splat's grid cell are tested.
const copyGLSL = /* glsl */ `
    uniform highp sampler2D uSphereTex;     // RGBA32F, one texel per sphere: xyz center, w radius
    uniform highp sampler2D uGridTex;       // RGBA32F, GW x GH: r = list start, g = list count
    uniform highp sampler2D uListTex;       // RGBA32F, flat sphere-index list: r = sphere index
    uniform vec2 uGridMin;                  // world XZ of grid origin
    uniform vec2 uGridInvCell;              // 1 / cell size (XZ)
    uniform vec2 uGridDims;                 // grid dimensions (columns, rows)

    void modifySplatCenter(inout vec3 center) {}

    void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}

    void modifySplatColor(vec3 center, inout vec4 color) {
        float bestSway = 0.0;
        float bestHeight = 0.0;
        float bestIndex = 0.0;   // 1-based; 0 means "not bound to any tree"

        ivec2 cell = ivec2(floor((center.xz - uGridMin) * uGridInvCell));
        if (cell.x >= 0 && cell.y >= 0 && float(cell.x) < uGridDims.x && float(cell.y) < uGridDims.y) {
            vec4 g = texelFetch(uGridTex, cell, 0);
            int start = int(g.r + 0.5);
            int count = int(g.g + 0.5);
            for (int k = 0; k < ${MAX_CELL_SPHERES}; k++) {
                if (k >= count) {
                    break;
                }
                int si = int(texelFetch(uListTex, ivec2(start + k, 0), 0).r + 0.5);
                vec4 sphere = texelFetch(uSphereTex, ivec2(si, 0), 0);
                float radius = sphere.w;
                float dist = length(center - sphere.xyz);
                if (dist < radius) {
                    float bottomY = sphere.y - radius;
                    float height = clamp((center.y - bottomY) / (2.0 * radius), 0.0, 1.0);
                    float edgeFade = smoothstep(radius, radius * 0.8, dist);
                    float sway = pow(height, 1.3) * edgeFade;
                    if (sway > bestSway) {
                        bestSway = sway;
                        bestHeight = height;
                        bestIndex = float(si + 1);
                    }
                }
            }
        }

        float lo = mod(bestIndex, 256.0) / 255.0;
        float hi = floor(bestIndex / 256.0) / 255.0;
        writeTreeBind(vec4(bestSway, bestHeight, lo, hi));
    }
`;

const copyWGSL = /* wgsl */ `
    var uSphereTex: texture_2d<f32>;
    var uGridTex: texture_2d<f32>;
    var uListTex: texture_2d<f32>;
    uniform uGridMin: vec2f;
    uniform uGridInvCell: vec2f;
    uniform uGridDims: vec2f;

    fn modifySplatCenter(center: ptr<function, vec3f>) {}

    fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}

    fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
        var bestSway = 0.0;
        var bestHeight = 0.0;
        var bestIndex = 0.0;

        let cell = vec2i(floor((center.xz - uniform.uGridMin) * uniform.uGridInvCell));
        if (cell.x >= 0 && cell.y >= 0 && f32(cell.x) < uniform.uGridDims.x && f32(cell.y) < uniform.uGridDims.y) {
            let g = textureLoad(uGridTex, cell, 0);
            let start = i32(g.r + 0.5);
            let count = i32(g.g + 0.5);
            for (var k = 0; k < ${MAX_CELL_SPHERES}; k++) {
                if (k >= count) {
                    break;
                }
                let si = i32(textureLoad(uListTex, vec2i(start + k, 0), 0).r + 0.5);
                let sphere = textureLoad(uSphereTex, vec2i(si, 0), 0);
                let radius = sphere.w;
                let dist = length(center - sphere.xyz);
                if (dist < radius) {
                    let bottomY = sphere.y - radius;
                    let height = clamp((center.y - bottomY) / (2.0 * radius), 0.0, 1.0);
                    let edgeFade = smoothstep(radius, radius * 0.8, dist);
                    let sway = pow(height, 1.3) * edgeFade;
                    if (sway > bestSway) {
                        bestSway = sway;
                        bestHeight = height;
                        bestIndex = f32(si + 1);
                    }
                }
            }
        }

        let lo = (bestIndex % 256.0) / 255.0;
        let hi = floor(bestIndex / 256.0) / 255.0;
        writeTreeBind(vec4f(bestSway, bestHeight, lo, hi));
    }
`;

// --- Render stage: runs every frame for every splat. Reads the baked bind and applies a cheap
// horizontal sway (cantilever oscillation growing with the baked sway amount, a wave travelling
// up the tree via the height fraction, a slow gust and a fast flutter). While editing, the
// currently selected tree is tinted so you can see which splats it owns.
const renderGLSL = /* glsl */ `
    uniform float uTime;
    uniform vec2 uWindDir;          // horizontal wind direction (world XZ)
    uniform float uWindStrength;
    uniform float uWindSpeed;
    uniform float uGustiness;
    uniform float uFlutter;
    uniform float uWaveTravel;
    uniform float uEditSelected;    // selected tree index while editing, or -1

    void modifySplatCenter(inout vec3 center) {
        vec4 bind = loadTreeBind();
        float sway = bind.x;
        if (sway > 0.0) {
            float treeIndex = floor(bind.z * 255.0 + 0.5) + floor(bind.w * 255.0 + 0.5) * 256.0 - 1.0;
            float height = bind.y;
            float phase = fract(treeIndex * 0.61803) * 6.28318;
            float osc = sin(uTime * uWindSpeed - height * uWaveTravel + phase);
            float gust = 1.0 + uGustiness * sin(uTime * 0.5 + phase);
            float mag = uWindStrength * sway * gust * osc;
            float flick = uWindStrength * uFlutter * sway * sin(uTime * uWindSpeed * 3.1 + phase * 2.3 + height * 17.0);
            center.x += uWindDir.x * mag - uWindDir.y * flick;
            center.z += uWindDir.y * mag + uWindDir.x * flick;
        }
    }

    void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}

    void modifySplatColor(vec3 center, inout vec4 color) {
        if (uEditSelected >= 0.0) {
            vec4 bind = loadTreeBind();
            if (bind.x > 0.0) {
                float treeIndex = floor(bind.z * 255.0 + 0.5) + floor(bind.w * 255.0 + 0.5) * 256.0 - 1.0;
                if (abs(treeIndex - uEditSelected) < 0.5) {
                    color.rgb = mix(color.rgb, vec3(1.0, 0.15, 0.1), 0.6);
                }
            }
        }
    }
`;

const renderWGSL = /* wgsl */ `
    uniform uTime: f32;
    uniform uWindDir: vec2f;
    uniform uWindStrength: f32;
    uniform uWindSpeed: f32;
    uniform uGustiness: f32;
    uniform uFlutter: f32;
    uniform uWaveTravel: f32;
    uniform uEditSelected: f32;

    fn modifySplatCenter(center: ptr<function, vec3f>) {
        let bind = loadTreeBind();
        let sway = bind.x;
        if (sway > 0.0) {
            let treeIndex = floor(bind.z * 255.0 + 0.5) + floor(bind.w * 255.0 + 0.5) * 256.0 - 1.0;
            let height = bind.y;
            let phase = fract(treeIndex * 0.61803) * 6.28318;
            let osc = sin(uniform.uTime * uniform.uWindSpeed - height * uniform.uWaveTravel + phase);
            let gust = 1.0 + uniform.uGustiness * sin(uniform.uTime * 0.5 + phase);
            let mag = uniform.uWindStrength * sway * gust * osc;
            let flick = uniform.uWindStrength * uniform.uFlutter * sway * sin(uniform.uTime * uniform.uWindSpeed * 3.1 + phase * 2.3 + height * 17.0);
            (*center).x += uniform.uWindDir.x * mag - uniform.uWindDir.y * flick;
            (*center).z += uniform.uWindDir.y * mag + uniform.uWindDir.x * flick;
        }
    }

    fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}

    fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
        if (uniform.uEditSelected >= 0.0) {
            let bind = loadTreeBind();
            if (bind.x > 0.0) {
                let treeIndex = floor(bind.z * 255.0 + 0.5) + floor(bind.w * 255.0 + 0.5) * 256.0 - 1.0;
                if (abs(treeIndex - uniform.uEditSelected) < 0.5) {
                    (*color) = vec4f(mix((*color).rgb, vec3f(1.0, 0.15, 0.1), 0.6), (*color).a);
                }
            }
        }
    }
`;

/**
 * Wind swaying of trees inside a gaussian splat scene, driven by a set of spheres. Each sphere
 * marks the green canopy of one tree; its bottom point is where the trunk connects, so the sway
 * is zero there and grows up and out towards the branch tips. The binding of each splat to a
 * sphere is baked into an extra RGBA8 work buffer stream during the copy stage (cheap, not
 * per-frame, and automatically re-run for streamed LOD data; accelerated by a uniform XZ grid so
 * hundreds of trees stay affordable), and a small per-frame vertex modifier applies the movement.
 * There is no fixed limit on the number of trees - the spheres and grid live in textures that
 * resize as needed. Attach the script to the entity holding the (unified) gsplat component.
 *
 * @example
 * const trees = entity.script.create(GsplatTrees);
 * trees.setSpheres([{ center: new pc.Vec3(0, 3, 0), radius: 3 }]);
 */
class GsplatTrees extends Script {
    static scriptName = 'gsplatTrees';

    /** @attribute @type {number} */
    strength = 0.25;

    /** @attribute @type {number} */
    speed = 1.0;

    /** @attribute @type {number} */
    direction = 45;

    /** @attribute @type {number} */
    gustiness = 0.4;

    /** @attribute @type {number} */
    flutter = 0.3;

    /** @attribute @type {number} */
    waveTravel = 2.5;

    /**
     * Index of the tree highlighted while editing, or -1 for none.
     *
     * @type {number}
     */
    editSelected = -1;

    /** @type {{ center: Vec3, radius: number }[]} */
    _spheres = [];

    _time = 0;

    _configured = false;

    /** @type {Texture|null} */
    _sphereTex = null;

    /** @type {Texture|null} */
    _gridTex = null;

    /** @type {Texture|null} */
    _listTex = null;

    initialize() {
        this._configure();
        this.on('destroy', () => this._cleanup());
    }

    /**
     * Sets the tree spheres. Each sphere marks one tree's canopy: its bottom point is the trunk
     * anchor and the sway grows towards the top. Triggers a re-bake of the splat bindings.
     *
     * @param {{ center: Vec3, radius: number }[]} spheres - The tree spheres.
     */
    setSpheres(spheres) {
        this._spheres = spheres.map(s => ({ center: s.center.clone(), radius: s.radius }));
        this._rebuild();
    }

    /**
     * Gets the current tree spheres.
     *
     * @returns {{ center: Vec3, radius: number }[]} The tree spheres.
     */
    getSpheres() {
        return this._spheres;
    }

    /**
     * Rebuilds the sphere and grid textures and forces a re-bake. Call after mutating spheres.
     */
    refresh() {
        this._rebuild();
    }

    _material() {
        return this.app.scene.gsplat?.material ?? null;
    }

    _makeDataTexture(existing, width, height, name) {
        if (existing && existing.width === width && existing.height === height) {
            return existing;
        }
        existing?.destroy();
        return new Texture(this.app.graphicsDevice, {
            name,
            width,
            height,
            format: PIXELFORMAT_RGBA32F,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
    }

    _configure() {
        const gsplat = this.entity.gsplat;
        const material = this._material();
        if (!gsplat || !material) {
            return;
        }

        const scene = this.app.scene;
        if (!formatsWithStream.has(scene.gsplat.format)) {
            scene.gsplat.format.addExtraStreams([{ name: 'treeBind', format: PIXELFORMAT_RGBA8 }]);
            formatsWithStream.add(scene.gsplat.format);
        }

        gsplat.setWorkBufferModifier({ glsl: copyGLSL, wgsl: copyWGSL });

        material.getShaderChunks('glsl').set('gsplatModifyVS', renderGLSL);
        material.getShaderChunks('wgsl').set('gsplatModifyVS', renderWGSL);
        material.update();

        this._configured = true;
        this._rebuild();
    }

    // Build the sphere texture and a uniform XZ grid bucketing spheres into cells, then upload
    // them to the copy shader and force a re-bake.
    _rebuild() {
        const gsplat = this.entity.gsplat;
        if (!this._configured || !gsplat) {
            return;
        }

        const spheres = this._spheres;
        const count = spheres.length;

        // sphere texture (one texel per sphere)
        this._sphereTex = this._makeDataTexture(this._sphereTex, Math.max(1, count), 1, 'TreeSpheres');
        const sphereData = this._sphereTex.lock();
        sphereData.fill(0);
        for (let i = 0; i < count; i++) {
            const s = spheres[i];
            sphereData[i * 4] = s.center.x;
            sphereData[i * 4 + 1] = s.center.y;
            sphereData[i * 4 + 2] = s.center.z;
            sphereData[i * 4 + 3] = s.radius;
        }
        this._sphereTex.unlock();

        // XZ bounds of all sphere footprints
        let minX = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxZ = -Infinity;
        for (let i = 0; i < count; i++) {
            const s = spheres[i];
            minX = Math.min(minX, s.center.x - s.radius);
            maxX = Math.max(maxX, s.center.x + s.radius);
            minZ = Math.min(minZ, s.center.z - s.radius);
            maxZ = Math.max(maxZ, s.center.z + s.radius);
        }
        if (count === 0) {
            minX = 0; maxX = 1; minZ = 0; maxZ = 1;
        }

        // grid dimensions - aim for roughly a handful of spheres per cell
        const dim = math.clamp(Math.ceil(Math.sqrt(count)), 1, 64);
        const cellW = Math.max((maxX - minX) / dim, 1e-3);
        const cellH = Math.max((maxZ - minZ) / dim, 1e-3);

        // bucket spheres into cells by their XZ footprint
        const cells = [];
        for (let i = 0; i < dim * dim; i++) {
            cells.push([]);
        }
        for (let i = 0; i < count; i++) {
            const s = spheres[i];
            const cx0 = math.clamp(Math.floor((s.center.x - s.radius - minX) / cellW), 0, dim - 1);
            const cx1 = math.clamp(Math.floor((s.center.x + s.radius - minX) / cellW), 0, dim - 1);
            const cz0 = math.clamp(Math.floor((s.center.z - s.radius - minZ) / cellH), 0, dim - 1);
            const cz1 = math.clamp(Math.floor((s.center.z + s.radius - minZ) / cellH), 0, dim - 1);
            for (let cz = cz0; cz <= cz1; cz++) {
                for (let cx = cx0; cx <= cx1; cx++) {
                    cells[cz * dim + cx].push(i);
                }
            }
        }

        // flatten into a grid texture (start, count per cell) and an index list texture
        this._gridTex = this._makeDataTexture(this._gridTex, dim, dim, 'TreeGrid');
        const gridData = this._gridTex.lock();
        gridData.fill(0);
        const list = [];
        for (let c = 0; c < dim * dim; c++) {
            gridData[c * 4] = list.length;
            gridData[c * 4 + 1] = cells[c].length;
            for (const si of cells[c]) {
                list.push(si);
            }
        }
        this._gridTex.unlock();

        this._listTex = this._makeDataTexture(this._listTex, Math.max(1, list.length), 1, 'TreeList');
        const listData = this._listTex.lock();
        listData.fill(0);
        for (let i = 0; i < list.length; i++) {
            listData[i * 4] = list[i];
        }
        this._listTex.unlock();

        // upload to the copy shader (component uniforms) and force a re-bake
        gsplat.setParameter('uSphereTex', this._sphereTex);
        gsplat.setParameter('uGridTex', this._gridTex);
        gsplat.setParameter('uListTex', this._listTex);
        gsplat.setParameter('uGridMin', [minX, minZ]);
        gsplat.setParameter('uGridInvCell', [1 / cellW, 1 / cellH]);
        gsplat.setParameter('uGridDims', [dim, dim]);
        gsplat.workBufferUpdate = WORKBUFFER_UPDATE_ONCE;
    }

    _cleanup() {
        const material = this._material();
        if (material) {
            material.getShaderChunks('glsl').delete('gsplatModifyVS');
            material.getShaderChunks('wgsl').delete('gsplatModifyVS');
            material.update();
        }
        const gsplat = this.entity.gsplat;
        if (gsplat) {
            gsplat.setWorkBufferModifier(null);
            gsplat.workBufferUpdate = WORKBUFFER_UPDATE_ONCE;
        }
        this._sphereTex?.destroy();
        this._gridTex?.destroy();
        this._listTex?.destroy();
    }

    update(dt) {
        if (!this._configured) {
            this._configure();
            return;
        }

        this._time += dt;
        const material = this._material();
        if (!material) {
            return;
        }
        const angle = this.direction * math.DEG_TO_RAD;
        material.setParameter('uTime', this._time);
        material.setParameter('uWindDir', [Math.cos(angle), Math.sin(angle)]);
        material.setParameter('uWindStrength', this.strength);
        material.setParameter('uWindSpeed', this.speed);
        material.setParameter('uGustiness', this.gustiness);
        material.setParameter('uFlutter', this.flutter);
        material.setParameter('uWaveTravel', this.waveTravel);
        material.setParameter('uEditSelected', this.editSelected);
    }
}

export { GsplatTrees };
