import {
    BUFFER_DYNAMIC,
    BoundingBox,
    Color,
    Entity,
    Mat4,
    MeshInstance,
    Quat,
    Script,
    StandardMaterial,
    TYPE_FLOAT32,
    Vec3,
    VertexBuffer,
    VertexFormat,
    math
} from 'playcanvas';

import { VAT_FRAME_SEMANTIC, VAT_TRANSFORM_SEMANTICS, setupVatMaterial } from './vat-chunks.mjs';
import { createVatAlbedoTexture, createVatMesh, createVatTexture, createWhiteTexture, parseVat } from './vat-data.mjs';
import { createVatShaderMaterial } from './vat-material.mjs';

/**
 * @import { Scene, ShaderMaterial, Texture } from 'playcanvas'
 * @import { VatAnimation, VatData } from './vat-data.mjs'
 */

// per instance data: the three rows of the affine world transform, followed by the fractional frame
// index. The fourth row of the transform is always (0, 0, 0, 1) and the shader appends it, which
// keeps a quarter of the matrix off the bus
const FLOATS_PER_INSTANCE = 13;
const FRAME_OFFSET = 12;

// the capacity is allocated in multiples of this, to limit how often the instancing buffer is
// reallocated while the number of characters changes
const CAPACITY_GRANULARITY = 256;

const _mat = new Mat4();
const _pos = new Vec3();
const _quat = new Quat();
const _scale = new Vec3();
const _min = new Vec3();
const _max = new Vec3();
const _color = new Color();
const _lightDirection = new Float32Array(3);
const _lightColor = new Float32Array(3);
const _ambientSky = new Float32Array(3);
const _ambientGround = new Float32Array(3);

/**
 * Renders a crowd of characters animated using a VAT (Vertex Animation Texture). The skinned position
 * and normal of every vertex is evaluated ahead of time and baked into a texture, one texel per vertex
 * per sampled frame, and the vertex shader reads it back and interpolates between two neighbouring
 * frames. Skeletons, bone matrices and per character animation evaluation disappear entirely: the
 * whole crowd is one instanced draw call, and the only per character data is a world matrix and a
 * fractional frame index.
 *
 * That trade suits many cheap characters. It is a poor fit for a single hero character, which wants
 * real skinning, blending and inverse kinematics - none of which a baked texture can express.
 *
 * ## Authoring
 *
 * The data is baked offline by `convertToVat` in `vat-converter.mjs`, which samples a skinned glb and
 * returns a binary container. `saveVat` writes it out. The example under `animation/vat-characters`
 * does this from a file picker, so no build step is needed.
 *
 * Because the result is a fixed table of vertex positions rather than a rig, the source has to fit
 * within these limits:
 *
 * - The glb must contain **exactly one mesh**, and it must be **skinned**. The whole crowd is drawn
 *   with one mesh and one material, so a character split across several meshes or materials cannot be
 *   represented.
 * - `vertexCount * frameCount` must be at most 16.7 million (a 4096x4096 texture). Vertices are not
 *   limited by a texture dimension, so this trades against the frame count - roughly 218k vertices at
 *   77 frames, or 55k at 300.
 * - **Every animation is assumed to loop.** The first frame of each is duplicated after its last one
 *   so the tail interpolates back to the start. A non looping clip plays but holds its loop point.
 * - Animations are sampled at a fixed rate (10 fps by default) and interpolated at runtime, so fast
 *   motion may need a higher rate. Cost is linear in the rate.
 * - Only the base color texture is carried over, optionally, as a jpeg. Normal, roughness and other
 *   maps are not, and a {@link StandardMaterial} using this data is lit from the base color alone.
 * - Scale is uniform per character; positions are quantized over the bounds of all frames.
 *
 * ## Runtime
 *
 * Set {@link capacity} to the largest number of characters you need, then {@link count} to how many
 * are currently rendered - characters always render from index 0. Per instance data is uploaded once
 * per frame for the whole capacity, so allocating far more than you use costs bandwidth for nothing.
 *
 * Transforms are only recomputed when one of the setters is called, while frame indices advance every
 * frame, so a static crowd is nearly free on the CPU. Note that the crowd is a single mesh instance:
 * there is no per character frustum culling, and its bounds are maintained to cover every character.
 *
 * Lighting depends on {@link useStandardMaterial}. The default custom {@link ShaderMaterial} is a
 * hemispherical ambient ({@link ambientSky} and {@link ambientGround}) plus one directional light
 * taken from the {@link light} entity - it casts shadows but does not receive them. A
 * {@link StandardMaterial} instead gets the full engine lighting, including received shadows and
 * image based lighting, for a higher per pixel cost.
 *
 * @example
 * // authoring - convert a loaded glb container and save the result
 * import { convertToVat, saveVat } from 'playcanvas/scripts/esm/vat/vat-converter.mjs';
 *
 * const container = await convertToVat(app, glbAsset.resource, { fps: 10 });
 * saveVat(container, 'lumberjack.vat');
 *
 * @example
 * // runtime - a crowd of 100 walking characters
 * const entity = new Entity('Crowd');
 * entity.addComponent('script');
 * app.root.addChild(entity);
 *
 * const characters = entity.script.create(VatCharacters, {
 *     properties: {
 *         url: 'assets/vat/lumberjack.vat',
 *         castShadows: true,
 *         light: sunEntity
 *     }
 * });
 * await characters.ready;
 *
 * characters.capacity = 100;
 * characters.count = 100;
 *
 * const position = new Vec3();
 * for (let i = 0; i < characters.count; i++) {
 *     position.set(Math.random() * 20 - 10, 0, Math.random() * 20 - 10);
 *     characters.setPosition(i, position);
 *     characters.setEulerAngles(i, 0, Math.random() * 360, 0);
 *     characters.setScale(i, 1.8);
 *
 *     // a random start time keeps the crowd from walking in lock step
 *     characters.setAnimation(i, 'Walk', 0.9 + Math.random() * 0.2, true, Math.random() * 10);
 * }
 *
 * @example
 * // moving the crowd - only the transforms need writing, the script advances the animations
 * app.on('update', (dt) => {
 *     for (let i = 0; i < characters.count; i++) {
 *         position.set(walk[i].x, 0, walk[i].z);
 *         characters.setPosition(i, position);
 *     }
 * });
 *
 * @example
 * // a single character, switching animation by name or by index
 * characters.count = 1;
 * characters.setScale(0, 1.8);
 *
 * console.log(characters.animations.map(a => a.name));   // ['Walk', 'Poses', 'A-pose']
 *
 * characters.setAnimation(0, 'Poses', 1, false);         // play once, then hold
 * characters.setSpeed(0, 0.5);                           // half speed
 * characters.setTime(0, 0);                              // restart
 */
export class VatCharacters extends Script {
    static scriptName = 'vatCharacters';

    /**
     * The URL of the VAT container to render.
     *
     * @attribute
     * @type {string}
     */
    url = '';

    /**
     * Renders the characters using a {@link StandardMaterial}, which gives them the full engine
     * lighting including shadows, instead of the simple custom {@link ShaderMaterial}. This can only
     * be changed before the data is loaded.
     *
     * @attribute
     * @type {boolean}
     */
    useStandardMaterial = false;

    /**
     * Whether the characters cast shadows.
     *
     * @attribute
     * @type {boolean}
     */
    castShadows = false;

    /**
     * An entity with a directional light component the custom shader material takes its lighting
     * from. Ignored when a {@link StandardMaterial} is used, as the engine handles the lighting then.
     *
     * @attribute
     * @type {Entity|null}
     */
    light = null;

    /**
     * The ambient light arriving from above, used by the custom shader material. Together with
     * {@link ambientGround} this forms a hemispherical ambient term, which gives the unlit side of a
     * character some shape rather than a flat fill.
     *
     * Note that this is deliberately independent of {@link Scene#ambientLight}: that value is only a
     * fallback for scenes without an environment, and is normally left dark because a
     * {@link StandardMaterial} takes its ambient from the environment atlas instead.
     *
     * @attribute
     * @type {Color}
     * @default [0.4, 0.45, 0.55, 1]
     */
    ambientSky = new Color(0.4, 0.45, 0.55);

    /**
     * The ambient light bounced back from below, used by the custom shader material. See
     * {@link ambientSky}.
     *
     * @attribute
     * @type {Color}
     * @default [0.25, 0.22, 0.18, 1]
     */
    ambientGround = new Color(0.25, 0.22, 0.18);

    /**
     * Resolves once the VAT data has been loaded and the characters can be set up.
     *
     * @type {Promise<void>}
     */
    ready;

    /** @type {VatData|null} */
    _data = null;

    /** @type {Entity|null} */
    _entity = null;

    /** @type {MeshInstance|null} */
    _meshInstance = null;

    /** @type {VertexBuffer|null} */
    _vertexBuffer = null;

    /** @type {Texture[]} */
    _textures = [];

    /** @type {Float32Array} */
    _instanceData = new Float32Array(0);

    /** @type {Int32Array} */
    _animation = new Int32Array(0);

    /** @type {Float32Array} */
    _time = new Float32Array(0);

    /** @type {Float32Array} */
    _speed = new Float32Array(0);

    /** @type {Uint8Array} */
    _loop = new Uint8Array(0);

    /** @type {Float32Array} */
    _position = new Float32Array(0);

    /** @type {Float32Array} */
    _rotation = new Float32Array(0);

    /** @type {Float32Array} */
    _characterScale = new Float32Array(0);

    _capacity = 0;

    _count = 0;

    _transformsDirty = true;

    // radius of the character in its local space, used to bound the crowd
    _radius = 1;

    _aabb = new BoundingBox();

    /** @type {(() => void)} */
    _resolveReady;

    initialize() {

        this.ready = new Promise((resolve) => {
            this._resolveReady = resolve;
        });

        this.on('destroy', () => this._destroy());

        if (this.url) {
            this.load(this.url).catch(error => console.error(error));
        }
    }

    _destroy() {
        this._entity?.destroy();
        this._entity = null;
        this._meshInstance?.material?.destroy();
        this._meshInstance?.mesh?.destroy();
        this._meshInstance = null;
        this._vertexBuffer?.destroy();
        this._vertexBuffer = null;
        this._textures.forEach(texture => texture.destroy());
        this._textures.length = 0;
    }

    /**
     * Loads the VAT data from a URL.
     *
     * @param {string} url - The URL of the container to load.
     * @returns {Promise<void>} Resolves when the characters are ready to be used.
     */
    async load(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`VatCharacters: failed to load [${url}]: ${response.statusText}`);
        }
        return this.setData(await response.arrayBuffer());
    }

    /**
     * Sets up the characters from an already loaded VAT container. This allows data generated at
     * runtime to be displayed without saving it out first.
     *
     * @param {ArrayBuffer} container - The VAT container.
     * @returns {Promise<void>} Resolves when the characters are ready to be used.
     */
    async setData(container) {

        const device = this.app.graphicsDevice;
        const data = parseVat(container);
        this._data = data;

        // radius of a unit scaled character, used to bound the crowd conservatively without having
        // to take the rotation of each character into account
        this._radius = data.bounds.center.length() + data.bounds.halfExtents.length();

        const vatMap = createVatTexture(device, data);

        // the base color texture, or an untextured white stand-in when the data does not embed one
        const albedo = await createVatAlbedoTexture(device, data) ?? createWhiteTexture(device);
        this._textures.push(vatMap, albedo);

        // the material rendering the characters
        let material;
        if (this.useStandardMaterial) {
            material = new StandardMaterial();
            material.diffuseMap = albedo;
            material.gloss = 0.4;
            material.useMetalness = true;
            material.metalness = 0;
        } else {
            material = createVatShaderMaterial();
            material.setParameter('uAlbedoMap', albedo);
        }
        setupVatMaterial(material, vatMap, data);

        // a single mesh instance renders all the characters using instancing
        const mesh = createVatMesh(device, data);
        const meshInstance = new MeshInstance(mesh, material);
        this._meshInstance = meshInstance;

        // the crowd covers an area not known up front, so keep the bounds up to date manually
        meshInstance.setCustomAabb(this._aabb);

        this._entity = new Entity('VatCharacters');
        this._entity.addComponent('render', {
            meshInstances: [meshInstance],
            castShadows: this.castShadows
        });
        this.entity.addChild(this._entity);

        // allocate space for at least one character - note that the capacity might have been set
        // before the data was available, in which case only the vertex buffer is missing
        this.capacity = Math.max(this._capacity, 1);
        this._createVertexBuffer();
        this.count = Math.max(this._count, 1);

        this._resolveReady();
    }

    /**
     * The animations stored in the loaded VAT data.
     *
     * @type {VatAnimation[]}
     */
    get animations() {
        return this._data?.animations ?? [];
    }

    /**
     * Returns the index of the animation of the given name, or -1 when not found.
     *
     * @param {string} name - The name of the animation.
     * @returns {number} The index of the animation.
     */
    getAnimationIndex(name) {
        return this._data?.getAnimationIndex(name) ?? -1;
    }

    /**
     * Sets the number of characters the per instance data is allocated for. This is grown
     * automatically when {@link count} is increased, but can be set up front to avoid reallocations,
     * or lowered to reduce the amount of data uploaded to the GPU each frame.
     *
     * @type {number}
     */
    set capacity(value) {

        const capacity = Math.max(1, Math.ceil(value / CAPACITY_GRANULARITY) * CAPACITY_GRANULARITY);
        if (capacity === this._capacity) {
            return;
        }

        const grow = (Type, source, components) => {
            const array = new Type(capacity * components);
            array.set(source.subarray(0, Math.min(source.length, array.length)));
            return array;
        };

        this._instanceData = grow(Float32Array, this._instanceData, FLOATS_PER_INSTANCE);
        this._animation = grow(Int32Array, this._animation, 1);
        this._time = grow(Float32Array, this._time, 1);
        this._speed = grow(Float32Array, this._speed, 1);
        this._loop = grow(Uint8Array, this._loop, 1);
        this._position = grow(Float32Array, this._position, 3);
        this._rotation = grow(Float32Array, this._rotation, 4);
        this._characterScale = grow(Float32Array, this._characterScale, 1);

        // default any newly added characters to a valid state
        for (let i = this._capacity; i < capacity; i++) {
            this._speed[i] = 1;
            this._loop[i] = 1;
            this._rotation[i * 4 + 3] = 1;
            this._characterScale[i] = 1;
        }

        this._capacity = capacity;
        this._count = Math.min(this._count, capacity);
        this._transformsDirty = true;

        this._createVertexBuffer();
    }

    get capacity() {
        return this._capacity;
    }

    // (re)creates the instancing vertex buffer holding the per instance data
    _createVertexBuffer() {

        if (!this._meshInstance || this._vertexBuffer?.numVertices === this._capacity) {
            return;
        }

        this._vertexBuffer?.destroy();

        const device = this.app.graphicsDevice;
        const format = new VertexFormat(device, [
            ...VAT_TRANSFORM_SEMANTICS.map(semantic => ({                        // transform rows
                semantic: semantic, components: 4, type: TYPE_FLOAT32
            })),
            { semantic: VAT_FRAME_SEMANTIC, components: 1, type: TYPE_FLOAT32 }  // frame index
        ]);
        this._vertexBuffer = new VertexBuffer(device, format, this._capacity, { usage: BUFFER_DYNAMIC });
        this._meshInstance.setInstancing(this._vertexBuffer);
    }

    /**
     * Sets the number of characters that are rendered. Characters are always rendered from index 0,
     * and so the value also limits which characters can be modified.
     *
     * @type {number}
     */
    set count(value) {
        const count = Math.max(0, Math.floor(value));
        if (count > this._capacity) {
            this.capacity = count;
        }
        if (count !== this._count) {
            this._count = count;
            this._transformsDirty = true;
        }
    }

    get count() {
        return this._count;
    }

    /**
     * The local space bounds of a single character with a scale of one, covering all frames of all
     * animations.
     *
     * @type {BoundingBox}
     */
    get characterBounds() {
        return this._data?.bounds ?? new BoundingBox();
    }

    /**
     * Selects the animation played by a character.
     *
     * @param {number} index - The index of the character.
     * @param {number|string} animation - The index or the name of the animation.
     * @param {number} [speed] - The playback speed, defaults to 1.
     * @param {boolean} [loop] - Whether the animation loops, defaults to true.
     * @param {number} [time] - The time in seconds to start the animation at, defaults to 0.
     */
    setAnimation(index, animation, speed = 1, loop = true, time = 0) {
        const animationIndex = typeof animation === 'string' ? this.getAnimationIndex(animation) : animation;
        this._animation[index] = math.clamp(animationIndex, 0, this.animations.length - 1);
        this._speed[index] = speed;
        this._loop[index] = loop ? 1 : 0;
        this._time[index] = time;
    }

    /**
     * Sets the playback speed of a character.
     *
     * @param {number} index - The index of the character.
     * @param {number} speed - The playback speed.
     */
    setSpeed(index, speed) {
        this._speed[index] = speed;
    }

    /**
     * Sets whether the animation of a character loops.
     *
     * @param {number} index - The index of the character.
     * @param {boolean} loop - Whether the animation loops.
     */
    setLoop(index, loop) {
        this._loop[index] = loop ? 1 : 0;
    }

    /**
     * Sets the playback time of a character, in seconds.
     *
     * @param {number} index - The index of the character.
     * @param {number} time - The time in seconds.
     */
    setTime(index, time) {
        this._time[index] = time;
    }

    /**
     * Returns the playback time of a character, in seconds.
     *
     * @param {number} index - The index of the character.
     * @returns {number} The time in seconds.
     */
    getTime(index) {
        return this._time[index];
    }

    /**
     * Sets the position of a character, relative to the entity the script is attached to.
     *
     * @param {number} index - The index of the character.
     * @param {Vec3} position - The position.
     */
    setPosition(index, position) {
        const offset = index * 3;
        this._position[offset] = position.x;
        this._position[offset + 1] = position.y;
        this._position[offset + 2] = position.z;
        this._transformsDirty = true;
    }

    /**
     * Sets the rotation of a character.
     *
     * @param {number} index - The index of the character.
     * @param {Quat} rotation - The rotation.
     */
    setRotation(index, rotation) {
        const offset = index * 4;
        this._rotation[offset] = rotation.x;
        this._rotation[offset + 1] = rotation.y;
        this._rotation[offset + 2] = rotation.z;
        this._rotation[offset + 3] = rotation.w;
        this._transformsDirty = true;
    }

    /**
     * Sets the rotation of a character using euler angles, in degrees.
     *
     * @param {number} index - The index of the character.
     * @param {number} x - The rotation around the local space x-axis.
     * @param {number} y - The rotation around the local space y-axis.
     * @param {number} z - The rotation around the local space z-axis.
     */
    setEulerAngles(index, x, y, z) {
        this.setRotation(index, _quat.setFromEulerAngles(x, y, z));
    }

    /**
     * Sets the uniform scale of a character.
     *
     * @param {number} index - The index of the character.
     * @param {number} scale - The scale.
     */
    setScale(index, scale) {
        this._characterScale[index] = scale;
        this._transformsDirty = true;
    }

    /**
     * Sets the position, rotation and uniform scale of a character.
     *
     * @param {number} index - The index of the character.
     * @param {Vec3} position - The position.
     * @param {Quat} rotation - The rotation.
     * @param {number} scale - The uniform scale.
     */
    setTransform(index, position, rotation, scale) {
        this.setPosition(index, position);
        this.setRotation(index, rotation);
        this.setScale(index, scale);
    }

    // writes the world matrix of all rendered characters into the per instance data, and updates the
    // bounds covering the crowd
    _updateTransforms() {

        const count = this._count;
        const data = this._instanceData;
        const positions = this._position;
        const rotations = this._rotation;
        const scales = this._characterScale;
        const radius = this._radius;

        _min.set(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        _max.set(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

        for (let i = 0; i < count; i++) {

            const scale = scales[i];
            _pos.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            _quat.set(rotations[i * 4], rotations[i * 4 + 1], rotations[i * 4 + 2], rotations[i * 4 + 3]);
            _scale.set(scale, scale, scale);
            _mat.setTRS(_pos, _quat, _scale);

            // transpose the three useful rows out of the column major matrix, dropping the constant
            // fourth row the shader adds back
            const m = _mat.data;
            const offset = i * FLOATS_PER_INSTANCE;
            data[offset] = m[0]; data[offset + 1] = m[4]; data[offset + 2] = m[8]; data[offset + 3] = m[12];
            data[offset + 4] = m[1]; data[offset + 5] = m[5]; data[offset + 6] = m[9]; data[offset + 7] = m[13];
            data[offset + 8] = m[2]; data[offset + 9] = m[6]; data[offset + 10] = m[10]; data[offset + 11] = m[14];

            // expand the bounds by a sphere around the character, which avoids having to consider
            // its rotation
            const extent = radius * scale;
            _min.x = Math.min(_min.x, _pos.x - extent);
            _min.y = Math.min(_min.y, _pos.y - extent);
            _min.z = Math.min(_min.z, _pos.z - extent);
            _max.x = Math.max(_max.x, _pos.x + extent);
            _max.y = Math.max(_max.y, _pos.y + extent);
            _max.z = Math.max(_max.z, _pos.z + extent);
        }

        if (count > 0) {
            this._aabb.setMinMax(_min, _max);
            this._meshInstance.setCustomAabb(this._aabb);
        }
    }

    // supplies the custom shader material with the lighting of the scene
    _updateLighting() {

        const material = this._meshInstance.material;
        const light = this.light?.light;

        if (light) {

            // a directional light shines along the negative y-axis of its entity
            this.light.getWorldTransform().getY(_pos).mulScalar(-1).normalize();
            _lightDirection[0] = _pos.x;
            _lightDirection[1] = _pos.y;
            _lightDirection[2] = _pos.z;
            material.setParameter('uLightDirection', _lightDirection);

            _color.copy(light.color).linear();
            _lightColor[0] = _color.r * light.intensity;
            _lightColor[1] = _color.g * light.intensity;
            _lightColor[2] = _color.b * light.intensity;
            material.setParameter('uLightColor', _lightColor);
        }

        // the hemispherical ambient, converted to the linear space the shader works in
        const ambient = (color, target, name) => {
            _color.copy(color).linear();
            target[0] = _color.r;
            target[1] = _color.g;
            target[2] = _color.b;
            material.setParameter(name, target);
        };
        ambient(this.ambientSky, _ambientSky, 'uAmbientSky');
        ambient(this.ambientGround, _ambientGround, 'uAmbientGround');
    }

    update(dt) {

        const data = this._data;
        if (!data || !this._meshInstance) {
            return;
        }

        if (this._transformsDirty) {
            this._transformsDirty = false;
            this._updateTransforms();
        }

        if (!this.useStandardMaterial) {
            this._updateLighting();
        }

        // advance the animation of each character and store the fractional frame index the vertex
        // shader interpolates between
        const count = this._count;
        const animations = data.animations;
        const instanceData = this._instanceData;
        for (let i = 0; i < count; i++) {

            const animation = animations[this._animation[i]];
            const duration = animation.duration;

            let time = this._time[i] + dt * this._speed[i];
            if (this._loop[i]) {
                time -= Math.floor(time / duration) * duration;
            } else {
                time = math.clamp(time, 0, duration);
            }
            this._time[i] = time;

            // the shader interpolates between the frame the index falls in and the next one, so stay
            // just short of the duplicated frame at the end of the animation - otherwise a clamped,
            // non looping animation would read into the frames of the next one
            const frame = Math.min((time / duration) * animation.frameCount, animation.frameCount - 1e-4);
            instanceData[i * FLOATS_PER_INSTANCE + FRAME_OFFSET] = animation.frameStart + frame;
        }

        this._vertexBuffer.setData(instanceData);
        this._meshInstance.instancingCount = count;

        if (this._entity.render.castShadows !== this.castShadows) {
            this._entity.render.castShadows = this.castShadows;
        }
    }
}
