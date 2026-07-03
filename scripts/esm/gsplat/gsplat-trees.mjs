import { Script, PIXELFORMAT_RGBA16F, WORKBUFFER_UPDATE_ONCE, math } from 'playcanvas';

/**
 * @import { Vec3 } from 'playcanvas'
 */

/**
 * Maximum number of trees (sphere influence regions) supported by the shaders.
 *
 * @type {number}
 */
const MAX_TREES = 16;

// tracks which work buffer formats already have the tree stream, so the stream (which cannot be
// removed once added) is only added once per format
const formatsWithStream = new WeakSet();

// --- Copy stage: runs when splats are written to the work buffer (once on load, and again on
// demand when the trees change or during LOD streaming). For each splat it finds the tree sphere
// it belongs to and bakes a compact "bind" into an extra work buffer stream: how much the splat
// should sway (0 at the trunk anchor at the sphere bottom, growing up and out to the canopy),
// its height fraction (for the travelling wave) and a per-tree phase. Splats in no sphere bake a
// zero sway and are never moved. This is not per-frame, so it can afford the sphere loop.
const copyGLSL = /* glsl */ `
    uniform vec4 uTreeSpheres[${MAX_TREES}];    // xyz = world center, w = radius (0 = unused)

    void modifySplatCenter(inout vec3 center) {}

    void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}

    void modifySplatColor(vec3 center, inout vec4 color) {
        float bestSway = 0.0;
        float bestHeight = 0.0;
        float bestPhase = 0.0;
        for (int i = 0; i < ${MAX_TREES}; i++) {
            float radius = uTreeSpheres[i].w;
            if (radius <= 0.0) {
                continue;
            }
            vec3 sphereCenter = uTreeSpheres[i].xyz;
            float dist = length(center - sphereCenter);
            if (dist < radius) {
                // height fraction: 0 at the sphere bottom (trunk anchor), 1 at the top
                float bottomY = sphereCenter.y - radius;
                float height = clamp((center.y - bottomY) / (2.0 * radius), 0.0, 1.0);
                // fade to 0 at the sphere surface to avoid a hard cut, grow towards the canopy
                float edgeFade = smoothstep(radius, radius * 0.8, dist);
                float sway = pow(height, 1.3) * edgeFade;
                if (sway > bestSway) {
                    bestSway = sway;
                    bestHeight = height;
                    bestPhase = float(i) * 2.399;
                }
            }
        }
        writeTreeBind(vec4(bestSway, bestHeight, bestPhase, 0.0));
    }
`;

const copyWGSL = /* wgsl */ `
    uniform uTreeSpheres: array<vec4f, ${MAX_TREES}>;   // xyz = world center, w = radius (0 = unused)

    fn modifySplatCenter(center: ptr<function, vec3f>) {}

    fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}

    fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
        var bestSway = 0.0;
        var bestHeight = 0.0;
        var bestPhase = 0.0;
        for (var i = 0; i < ${MAX_TREES}; i++) {
            let radius = uniform.uTreeSpheres[i].w;
            if (radius <= 0.0) {
                continue;
            }
            let sphereCenter = uniform.uTreeSpheres[i].xyz;
            let dist = length(center - sphereCenter);
            if (dist < radius) {
                let bottomY = sphereCenter.y - radius;
                let height = clamp((center.y - bottomY) / (2.0 * radius), 0.0, 1.0);
                let edgeFade = smoothstep(radius, radius * 0.8, dist);
                let sway = pow(height, 1.3) * edgeFade;
                if (sway > bestSway) {
                    bestSway = sway;
                    bestHeight = height;
                    bestPhase = f32(i) * 2.399;
                }
            }
        }
        writeTreeBind(vec4f(bestSway, bestHeight, bestPhase, 0.0));
    }
`;

// --- Render stage: runs every frame for every splat. Reads the baked bind and applies a cheap
// horizontal sway - a cantilever oscillation (grows with the baked sway amount) with a wave
// travelling up the tree, a slow gust envelope and a fast flutter. Deliberately branchless-ish
// and free of any loop so it stays cheap per frame.
const renderGLSL = /* glsl */ `
    uniform float uTime;
    uniform vec2 uWindDir;          // horizontal wind direction (world XZ)
    uniform float uWindStrength;
    uniform float uWindSpeed;
    uniform float uGustiness;
    uniform float uFlutter;
    uniform float uWaveTravel;

    void modifySplatCenter(inout vec3 center) {
        vec4 bind = loadTreeBind();
        float sway = bind.x;
        if (sway > 0.0) {
            float height = bind.y;
            float phase = bind.z;
            float osc = sin(uTime * uWindSpeed - height * uWaveTravel + phase);
            float gust = 1.0 + uGustiness * sin(uTime * 0.5 + phase);
            float mag = uWindStrength * sway * gust * osc;
            float flick = uWindStrength * uFlutter * sway * sin(uTime * uWindSpeed * 3.1 + phase * 2.3 + height * 17.0);
            center.x += uWindDir.x * mag - uWindDir.y * flick;
            center.z += uWindDir.y * mag + uWindDir.x * flick;
        }
    }

    void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}

    void modifySplatColor(vec3 center, inout vec4 color) {}
`;

const renderWGSL = /* wgsl */ `
    uniform uTime: f32;
    uniform uWindDir: vec2f;         // horizontal wind direction (world XZ)
    uniform uWindStrength: f32;
    uniform uWindSpeed: f32;
    uniform uGustiness: f32;
    uniform uFlutter: f32;
    uniform uWaveTravel: f32;

    fn modifySplatCenter(center: ptr<function, vec3f>) {
        let bind = loadTreeBind();
        let sway = bind.x;
        if (sway > 0.0) {
            let height = bind.y;
            let phase = bind.z;
            let osc = sin(uniform.uTime * uniform.uWindSpeed - height * uniform.uWaveTravel + phase);
            let gust = 1.0 + uniform.uGustiness * sin(uniform.uTime * 0.5 + phase);
            let mag = uniform.uWindStrength * sway * gust * osc;
            let flick = uniform.uWindStrength * uniform.uFlutter * sway * sin(uniform.uTime * uniform.uWindSpeed * 3.1 + phase * 2.3 + height * 17.0);
            (*center).x += uniform.uWindDir.x * mag - uniform.uWindDir.y * flick;
            (*center).z += uniform.uWindDir.y * mag + uniform.uWindDir.x * flick;
        }
    }

    fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}

    fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {}
`;

/**
 * Wind swaying of trees inside a gaussian splat scene, driven by a set of spheres. Each sphere
 * marks the green canopy of one tree; its bottom point is where the trunk connects, so the sway
 * is zero there and grows up and out towards the branch tips. The binding of each splat to a
 * sphere is baked into an extra work buffer stream during the copy stage (cheap, not per-frame,
 * and automatically re-run for streamed LOD data), and a small per-frame vertex modifier applies
 * the actual movement. Attach the script to the entity holding the (unified) gsplat component.
 *
 * @example
 * const trees = entity.script.create(GsplatTrees);
 * trees.setSpheres([{ center: new pc.Vec3(-4.3, 5.4, 5.65), radius: 3.6 }]);
 */
class GsplatTrees extends Script {
    static scriptName = 'gsplatTrees';

    /**
     * Wind strength - the horizontal sway amplitude at the canopy tips, in world units.
     *
     * @attribute
     * @type {number}
     */
    strength = 0.25;

    /**
     * Wind speed - how fast the sway oscillates.
     *
     * @attribute
     * @type {number}
     */
    speed = 1.0;

    /**
     * Wind direction in degrees, in the horizontal (world XZ) plane.
     *
     * @attribute
     * @type {number}
     */
    direction = 45;

    /**
     * Gustiness - the depth of the slow amplitude envelope (0 = steady wind, 1 = strong gusts).
     *
     * @attribute
     * @type {number}
     */
    gustiness = 0.4;

    /**
     * Flutter - a fast, small perpendicular shimmer of the foliage (leaf flutter).
     *
     * @attribute
     * @type {number}
     */
    flutter = 0.3;

    /**
     * How far the sway wave lags as it travels up the tree.
     *
     * @attribute
     * @type {number}
     */
    waveTravel = 2.5;

    /** @type {{ center: Vec3, radius: number }[]} */
    _spheres = [];

    _time = 0;

    _sphereData = new Float32Array(MAX_TREES * 4);

    _configured = false;

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
        this._uploadSpheres();
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
     * Re-uploads the current spheres to the copy shader and forces a re-bake of the bindings.
     * Call this after mutating a sphere's center or radius in place.
     */
    refresh() {
        this._uploadSpheres();
    }

    _material() {
        return this.app.scene.gsplat?.material ?? null;
    }

    _configure() {
        const gsplat = this.entity.gsplat;
        const material = this._material();
        if (!gsplat || !material) {
            return;
        }

        const scene = this.app.scene;

        // add the extra work buffer stream once per format (it cannot be removed once added)
        if (!formatsWithStream.has(scene.gsplat.format)) {
            scene.gsplat.format.addExtraStreams([{ name: 'treeBind', format: PIXELFORMAT_RGBA16F }]);
            formatsWithStream.add(scene.gsplat.format);
        }

        // copy stage: bake the per-splat binding
        gsplat.setWorkBufferModifier({ glsl: copyGLSL, wgsl: copyWGSL });

        // render stage: apply the sway
        material.getShaderChunks('glsl').set('gsplatModifyVS', renderGLSL);
        material.getShaderChunks('wgsl').set('gsplatModifyVS', renderWGSL);
        material.update();

        this._configured = true;
        this._uploadSpheres();
    }

    _uploadSpheres() {
        const gsplat = this.entity.gsplat;
        if (!this._configured || !gsplat) {
            return;
        }
        this._sphereData.fill(0);
        const count = Math.min(this._spheres.length, MAX_TREES);
        for (let i = 0; i < count; i++) {
            const s = this._spheres[i];
            const o = i * 4;
            this._sphereData[o] = s.center.x;
            this._sphereData[o + 1] = s.center.y;
            this._sphereData[o + 2] = s.center.z;
            this._sphereData[o + 3] = s.radius;
        }
        gsplat.setParameter('uTreeSpheres[0]', this._sphereData);
        // re-run the copy stage so the bindings reflect the new spheres
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
    }

    update(dt) {
        // material may only become available a frame or two after load
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
    }
}

export { GsplatTrees };
