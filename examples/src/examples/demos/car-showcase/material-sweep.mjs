import { MeshInstance, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from 'playcanvas';

/**
 * @import { Asset, Color, Entity, Layer, StandardMaterial } from 'playcanvas'
 */

// The emissive chunk of the standard material, extended by the sweep: a front moving along the
// world Z axis, ragged by a noise. The new materials keep the part of the car the front has passed,
// the old materials the part it has not reached, and the front glows.
const glslChunk = /* glsl */ `
#ifndef MESH_COLOR
    uniform vec3 material_emissive;
#endif
uniform float material_emissiveIntensity;
uniform float sweepPosition;
uniform float sweepSide;
uniform vec3 sweepGlow;

float sweepHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1) * 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float sweepNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(sweepHash(i), sweepHash(i + vec3(1.0, 0.0, 0.0)), f.x),
            mix(sweepHash(i + vec3(0.0, 1.0, 0.0)), sweepHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
        mix(mix(sweepHash(i + vec3(0.0, 0.0, 1.0)), sweepHash(i + vec3(1.0, 0.0, 1.0)), f.x),
            mix(sweepHash(i + vec3(0.0, 1.0, 1.0)), sweepHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
        f.z);
}

void getEmission() {
    #ifdef MESH_COLOR
        dEmission = mesh_color.rgb * material_emissiveIntensity;
    #else
        dEmission = material_emissive * material_emissiveIntensity;
    #endif

    #ifdef STD_EMISSIVE_TEXTURE
    dEmission *= {STD_EMISSIVE_TEXTURE_DECODE}(texture2DBias({STD_EMISSIVE_TEXTURE_NAME}, {STD_EMISSIVE_TEXTURE_UV}, {STD_TEXTURE_BIAS})).{STD_EMISSIVE_TEXTURE_CHANNEL};
    #endif

    float front = vPositionW.z + (sweepNoise(vPositionW * 9.0) - 0.5) * 0.3 - sweepPosition;
    if (front * sweepSide < 0.0) {
        discard;
    }
    dEmission += sweepGlow * (1.0 - smoothstep(0.0, 0.05, abs(front)));
}
`;

const wgslChunk = /* wgsl */ `
#ifndef MESH_COLOR
    uniform material_emissive: vec3f;
#endif
uniform material_emissiveIntensity: f32;
uniform sweepPosition: f32;
uniform sweepSide: f32;
uniform sweepGlow: vec3f;

fn sweepHash(pIn: vec3f) -> f32 {
    let p = fract(pIn * 0.3183099 + 0.1) * 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

fn sweepNoise(x: vec3f) -> f32 {
    let i = floor(x);
    var f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(sweepHash(i), sweepHash(i + vec3f(1.0, 0.0, 0.0)), f.x),
            mix(sweepHash(i + vec3f(0.0, 1.0, 0.0)), sweepHash(i + vec3f(1.0, 1.0, 0.0)), f.x), f.y),
        mix(mix(sweepHash(i + vec3f(0.0, 0.0, 1.0)), sweepHash(i + vec3f(1.0, 0.0, 1.0)), f.x),
            mix(sweepHash(i + vec3f(0.0, 1.0, 1.0)), sweepHash(i + vec3f(1.0, 1.0, 1.0)), f.x), f.y),
        f.z);
}

fn getEmission() {
    #ifdef MESH_COLOR
        dEmission = uniform.mesh_color.rgb * uniform.material_emissiveIntensity;
    #else
        dEmission = uniform.material_emissive * uniform.material_emissiveIntensity;
    #endif

    #ifdef STD_EMISSIVE_TEXTURE
    dEmission *= {STD_EMISSIVE_TEXTURE_DECODE}(textureSampleBias({STD_EMISSIVE_TEXTURE_NAME}, {STD_EMISSIVE_TEXTURE_NAME}Sampler, {STD_EMISSIVE_TEXTURE_UV}, {STD_TEXTURE_BIAS})).{STD_EMISSIVE_TEXTURE_CHANNEL};
    #endif

    let front = vPositionW.z + (sweepNoise(vPositionW * 9.0) - 0.5) * 0.3 - uniform.sweepPosition;
    if (front * uniform.sweepSide < 0.0) {
        discard;
    }
    dEmission += uniform.sweepGlow * (1.0 - smoothstep(0.0, 0.05, abs(front)));
}
`;

// A sweep position which keeps all of the car with the current materials
const IDLE = -1000;

const smoothstep = (/** @type {number} */ t) => t * t * (3 - 2 * t);

/**
 * Changes materials of the car with a glowing front sweeping along it. The materials exist twice,
 * in two banks. A change sets up the other bank with the new materials and gives it to the car,
 * while copies of the mesh instances keep rendering the old materials, which the front then
 * reveals the new ones under.
 *
 * The materials are in slots, each with a variant for each look, named `<slot> <look>` in the
 * glTF. A change of the look swaps the variants of all slots.
 */
class MaterialSweep {
    /**
     * The duration of the sweep, in seconds.
     *
     * @type {number}
     */
    duration = 1.6;

    /** @type {Record<string, Record<string, StandardMaterial>>[]} */
    _banks;

    _bank = 0;

    /** @type {{ meshInstance: MeshInstance, slot: string }[]} */
    _instances = [];

    /** @type {MeshInstance[]|null} */
    _copies = null;

    _time = 0;

    /**
     * @param {object} options - The options.
     * @param {Asset<'container'>} options.asset - The container asset of the car.
     * @param {Entity} options.entity - The car instantiated from the asset.
     * @param {Layer} options.layer - The layer the car renders in.
     * @param {string[]} options.slots - The slots of the materials.
     * @param {string[]} options.looks - The looks of the materials.
     * @param {number} options.start - The world Z position the front starts at.
     * @param {number} options.end - The world Z position the front ends at.
     * @param {Color} options.glow - The color of the glowing front.
     * @param {number} options.intensity - The intensity of the glowing front.
     */
    constructor({ asset, entity, layer, slots, looks, start, end, glow, intensity }) {
        this._layer = layer;
        this._slots = slots;
        this._start = start;
        this._end = end;
        this._glow = new Float32Array([glow.r * intensity, glow.g * intensity, glow.b * intensity]);

        /**
         * @param {string} name - The name of the material.
         * @returns {StandardMaterial} The material.
         */
        const find = (name) =>
            /** @type {StandardMaterial} */ (
                asset.resource.materials.find((material) => material.resource.name === name).resource
            );

        // the first bank holds the materials of the car, the second their clones
        /** @type {Record<string, Record<string, StandardMaterial>>} */
        const originals = {};
        /** @type {Record<string, Record<string, StandardMaterial>>} */
        const clones = {};
        slots.forEach((slot) => {
            originals[slot] = {};
            clones[slot] = {};
            looks.forEach((look) => {
                const material = find(`${slot} ${look}`);
                material.getShaderChunks(SHADERLANGUAGE_GLSL).set('emissivePS', glslChunk);
                material.getShaderChunks(SHADERLANGUAGE_WGSL).set('emissivePS', wgslChunk);
                material.shaderChunksVersion = '2.24';
                originals[slot][look] = material;
                clones[slot][look] = material.clone();
            });
        });
        this._banks = [originals, clones];
        this._setSweep(IDLE, 0, 1);
        this._setSweep(IDLE, 1, 1);

        // the mesh instances using the materials, the car starts with the first look
        entity.findComponents('render').forEach((render) => {
            /** @type {import('playcanvas').RenderComponent} */ (render).meshInstances.forEach((meshInstance) => {
                const slot = slots.find((name) => meshInstance.material.name.startsWith(name));
                if (slot) {
                    this._instances.push({ meshInstance, slot });
                }
            });
        });
    }

    /**
     * Changes the materials.
     *
     * @param {string} look - The look to change to.
     * @param {(materials: Record<string, StandardMaterial>) => void} configure - Sets up the new
     * materials of the look, by their slots, before the car shows them.
     * @param {boolean} animate - Whether to sweep the new materials over the old ones.
     */
    apply(look, configure, animate) {
        this._finish();

        const bank = this._banks[1 - this._bank];
        /** @type {Record<string, StandardMaterial>} */
        const materials = {};
        this._slots.forEach((slot) => {
            materials[slot] = bank[slot][look];
        });
        configure(materials);

        if (animate) {
            // the copies keep the old materials, which stay ahead of the front
            this._copies = this._instances.map(({ meshInstance }) => {
                const copy = new MeshInstance(meshInstance.mesh, meshInstance.material, meshInstance.node);
                copy.castShadow = false;
                copy.mask = meshInstance.mask;
                return copy;
            });
            this._layer.addMeshInstances(this._copies);
            this._time = 0;
            this._setSweep(this._start, this._bank, -1);
            this._setSweep(this._start, 1 - this._bank, 1);
        }

        this._bank = 1 - this._bank;
        this._instances.forEach(({ meshInstance, slot }) => {
            meshInstance.material = materials[slot];
        });
    }

    /**
     * @param {number} dt - The time step, in seconds.
     */
    update(dt) {
        if (this._copies) {
            this._time += dt;
            const t = Math.min(this._time / this.duration, 1);
            const position = this._start + (this._end - this._start) * smoothstep(t);
            this._setSweep(position, 0);
            this._setSweep(position, 1);
            if (t >= 1) {
                this._finish();
            }
        }
    }

    /** @private */
    _finish() {
        if (this._copies) {
            this._layer.removeMeshInstances(this._copies);
            this._copies.forEach((copy) => copy.destroy());
            this._copies = null;
            this._setSweep(IDLE, this._bank, 1);
        }
    }

    /**
     * @param {number} position - The position of the front.
     * @param {number} bank - The index of the bank.
     * @param {number} [side] - 1 to keep the part the front has passed, -1 the part it has not
     * reached.
     * @private
     */
    _setSweep(position, bank, side) {
        Object.values(this._banks[bank]).forEach((looks) => {
            Object.values(looks).forEach((material) => {
                material.setParameter('sweepPosition', position);
                material.setParameter('sweepGlow', this._glow);
                if (side !== undefined) {
                    material.setParameter('sweepSide', side);
                }
            });
        });
    }
}

export { MaterialSweep };
