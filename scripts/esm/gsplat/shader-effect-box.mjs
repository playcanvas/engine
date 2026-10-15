import { Vec3, Color, FloatPacking, Texture, PIXELFORMAT_RGBA16U } from 'playcanvas';
import { GSplatShaderEffect } from './gsplat-shader-effect.mjs';

const shaderGLSL = /* glsl */`
uniform highp usampler2D uLUT;
uniform vec3 uAabbMin;
uniform vec3 uAabbMax;
uniform vec3 uDirection;

// Global state for shader
bool g_insideAABB;
uvec4 g_lutValue;

void modifySplatCenter(inout vec3 center) {
    // Check if splat is inside AABB
    g_insideAABB = all(greaterThanEqual(center, uAabbMin)) && all(lessThanEqual(center, uAabbMax));
    
    if (!g_insideAABB) {
        return;
    }
    
    // Normalize direction (with safety check)
    float dirLen = length(uDirection);
    if (dirLen < 0.001) {
        g_insideAABB = false;
        return;
    }
    vec3 absDir = abs(uDirection / dirLen);
    
    // Calculate texel coordinate (0-255 along sweep direction)
    vec3 relPos = center - uAabbMin;
    vec3 boxSize = uAabbMax - uAabbMin;
    float boxLength = dot(boxSize, absDir);
    float splatPos = dot(relPos, absDir);
    float t = clamp(splatPos / boxLength, 0.0, 1.0);
    int texelX = int(t * 255.0);
    
    // Fetch LUT texel
    g_lutValue = texelFetch(uLUT, ivec2(texelX, 0), 0);
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
    if (!g_insideAABB) return;
    
    // Unpack scale from alpha channel (unpack 16-bit uint to half-float)
    float lutScale = unpackHalf2x16(g_lutValue.a).x;
    
    // If scale is 0, make invisible
    if (lutScale < 0.01) {
        scale = vec3(0.0);
        return;
    }
    
    // If scale is less than 1, progressively scale
    if (lutScale < 1.0) {
        scale *= lutScale;
    }
}

void modifySplatColor(vec3 center, inout vec4 color) {
    if (!g_insideAABB) return;
    
    // Unpack tint from RGB channels (unpack 16-bit uints to half-floats)
    vec3 tint = vec3(
        unpackHalf2x16(g_lutValue.r).x,
        unpackHalf2x16(g_lutValue.g).x,
        unpackHalf2x16(g_lutValue.b).x
    );
    
    color.rgb *= tint;
}
`;

const shaderWGSL = /* wgsl */`
var uLUT: texture_2d<u32>;
uniform uAabbMin: vec3f;
uniform uAabbMax: vec3f;
uniform uDirection: vec3f;

// Global state for shader
var<private> g_insideAABB: bool;
var<private> g_lutValue: vec4u;

fn modifySplatCenter(center: ptr<function, vec3f>) {
    // Check if splat is inside AABB
    g_insideAABB = all((*center) >= uniform.uAabbMin) && all((*center) <= uniform.uAabbMax);
    
    if (!g_insideAABB) {
        return;
    }
    
    // Normalize direction (with safety check)
    let dirLen = length(uniform.uDirection);
    if (dirLen < 0.001) {
        g_insideAABB = false;
        return;
    }
    let absDir = abs(uniform.uDirection / dirLen);
    
    // Calculate texel coordinate (0-255 along sweep direction)
    let relPos = (*center) - uniform.uAabbMin;
    let boxSize = uniform.uAabbMax - uniform.uAabbMin;
    let boxLength = dot(boxSize, absDir);
    let splatPos = dot(relPos, absDir);
    let t = clamp(splatPos / boxLength, 0.0, 1.0);
    let texelX = i32(t * 255.0);
    
    // Load LUT texel
    g_lutValue = textureLoad(uLUT, vec2i(texelX, 0), 0);
}

fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
    if (!g_insideAABB) { return; }
    
    // Unpack scale from alpha channel (unpack 16-bit uint to half-float)
    let lutScale = unpack2x16float(g_lutValue.a).x;
    
    // If scale is 0, make invisible
    if (lutScale < 0.01) {
        *scale = vec3f(0.0);
        return;
    }
    
    // If scale is less than 1, progressively scale
    if (lutScale < 1.0) {
        *scale = (*scale) * lutScale;
    }
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    if (!g_insideAABB) { return; }
    
    // Unpack tint from RGB channels (unpack 16-bit uints to half-floats)
    let tint = vec3f(
        unpack2x16float(g_lutValue.r).x,
        unpack2x16float(g_lutValue.g).x,
        unpack2x16float(g_lutValue.b).x
    );
    
    (*color) = vec4f((*color).rgb * tint, (*color).a);
}
`;

/**
 * Box shader effect for gaussian splats.
 * Applies a plane sweep effect within an AABB, with configurable visibility transitions and tinting.
 *
 * @example
 * // Add the script to a gsplat entity
 * entity.addComponent('script');
 * const boxScript = entity.script.create(GSplatBoxShaderEffect);
 * boxScript.aabbMin.set(-1, -1, -1);
 * boxScript.aabbMax.set(1, 1, 1);
 * @category Gaussian Splatting
 */
class GSplatBoxShaderEffect extends GSplatShaderEffect {
    static scriptName = 'gsplatBoxShaderEffect';

    /**
     * LUT texture for pre-computed tint/scale values
     * @type {import('playcanvas').Texture | null}
     * @private
     */
    _lutTexture = null;

    // Reusable arrays for uniform updates
    _aabbMinArray = [0, 0, 0];

    _aabbMaxArray = [0, 0, 0];

    _directionArray = [0, 0, 0];

    // Reusable Vec3 instances for LUT generation
    _normDir = new Vec3();

    _absDir = new Vec3();

    _boxSize = new Vec3();

    _additionalTint = new Vec3();

    _edgeTintVec = new Vec3();

    _tintVec = new Vec3();

    /**
     * Minimum corner of AABB in world space
     * @attribute
     */
    aabbMin = new Vec3(-0.5, -0.5, -0.5);

    /**
     * Maximum corner of AABB in world space
     * @attribute
     */
    aabbMax = new Vec3(0.5, 0.5, 0.5);

    /**
     * Direction of plane sweep through AABB
     * @attribute
     */
    direction = new Vec3(0, 1, 0);

    /**
     * Duration for plane to sweep through the box. The whole effect takes `duration + 2 * interval`,
     * as the transition around the plane enters the box before the plane does and leaves it after.
     * @attribute
     */
    duration = 1.0;

    /**
     * Initial visibility state (before sweep)
     * @attribute
     */
    visibleStart = false;

    /**
     * Final visibility state (after sweep)
     * @attribute
     */
    visibleEnd = true;

    /**
     * Transition duration for scaling/tinting at edge
     * @attribute
     */
    interval = 0.2;

    /**
     * Invert tinting direction (apply tint ahead of plane instead of behind)
     * @attribute
     */
    invertTint = false;

    /**
     * Base tint applied to all splats inside AABB
     * @attribute
     */
    baseTint = new Color(1, 1, 1);

    /**
     * Tint applied during edge transition
     * @attribute
     */
    edgeTint = new Color(1, 0, 1);

    /**
     * Tint applied to visible splats
     * @attribute
     */
    tint = new Color(1, 1, 1);

    initialize() {
        // Call parent initialize
        super.initialize();

        // Create LUT texture (256x1 RGBA16U - non-filterable, use textureLoad/texelFetch)
        this._lutTexture = new Texture(this.app.graphicsDevice, {
            name: 'GSplatEffectLUT',
            width: 256,
            height: 1,
            format: PIXELFORMAT_RGBA16U,
            mipmaps: false
        });
    }

    /**
     * Generate LUT texture by pre-computing tint/scale values for 256 positions along sweep
     * @private
     */
    generateLUT() {
        if (!this._lutTexture) return;

        // Lock texture to get typed array (Uint16Array for RGBA16U)
        const data = this._lutTexture.lock();

        // Calculate common values once
        const dirLen = this.direction.length();
        if (dirLen < 0.001) {
            // Invalid direction, fill with default values
            for (let i = 0; i < 256; i++) {
                const idx = i * 4;
                data[idx + 0] = FloatPacking.float2Half(1.0); // R
                data[idx + 1] = FloatPacking.float2Half(1.0); // G
                data[idx + 2] = FloatPacking.float2Half(1.0); // B
                data[idx + 3] = FloatPacking.float2Half(1.0); // A (scale)
            }
            this._lutTexture.unlock();
            return;
        }

        // Normalize direction and compute absolute direction
        this._normDir.copy(this.direction).normalize();
        this._absDir.set(Math.abs(this._normDir.x), Math.abs(this._normDir.y), Math.abs(this._normDir.z));

        // Calculate box size and box length along direction
        this._boxSize.sub2(this.aabbMax, this.aabbMin);
        const boxLength = this._boxSize.dot(this._absDir);

        const duration = Math.max(this.duration, 0.001);
        const edgeDistance = Math.max((this.interval / duration) * boxLength, 0.000001);

        // Plane position along the sweep, measured from the face of the box it enters through. It
        // starts edgeDistance before the box and stops edgeDistance past it, so the transition band
        // around the plane fully enters the box at the start and fully leaves it at the end
        const travel = Math.min((this.effectTime / duration) * boxLength, boxLength + 2 * edgeDistance);
        const planePos = travel - edgeDistance;

        const directionSign = this._normDir.x + this._normDir.y + this._normDir.z;
        const isNegativeDir = directionSign < 0.0;

        const visStart = this.visibleStart ? 1.0 : 0.0;
        const visEnd = this.visibleEnd ? 1.0 : 0.0;
        const isTintOnlyMode = this.visibleStart === this.visibleEnd;
        const invert = this.invertTint;

        this._tintVec.set(this.tint.r, this.tint.g, this.tint.b);
        this._edgeTintVec.set(this.edgeTint.r, this.edgeTint.g, this.edgeTint.b);

        // For each position along sweep direction (0 = aabbMin, 1 = aabbMax along direction)
        for (let i = 0; i < 256; i++) {
            const t = i / 255.0;
            const splatPos = (isNegativeDir ? 1.0 - t : t) * boxLength;

            // Positive where the plane has not arrived yet
            const distAhead = splatPos - planePos;

            // Compute scale (for reveal/hide modes), ramping from the start to the end state across
            // the band ahead of the plane
            let scale = 1.0;
            if (!isTintOnlyMode) {
                const tFront = Math.max(0.0, Math.min(1.0, distAhead / edgeDistance));
                scale = visEnd + (visStart - visEnd) * tFront;
            }

            // Tint-only mode tints the side the plane has passed (or the side ahead of it when
            // inverted), reveal/hide mode tints both sides
            const isAhead = distAhead > 0.0;
            const sideTint = (!isTintOnlyMode || isAhead === invert) ? this._tintVec : Vec3.ONE;

            // Edge tint peaks at the plane and fades out over edgeDistance on both sides
            const edgeFactor = Math.max(0.0, 1.0 - Math.abs(distAhead) / edgeDistance);
            this._additionalTint.lerp(sideTint, this._edgeTintVec, edgeFactor);

            // Apply base tint and additional tint (component-wise multiply)
            const tintR = this.baseTint.r * this._additionalTint.x;
            const tintG = this.baseTint.g * this._additionalTint.y;
            const tintB = this.baseTint.b * this._additionalTint.z;

            // Pack as half-floats into texture data
            const idx = i * 4;
            data[idx + 0] = FloatPacking.float2Half(tintR);
            data[idx + 1] = FloatPacking.float2Half(tintG);
            data[idx + 2] = FloatPacking.float2Half(tintB);
            data[idx + 3] = FloatPacking.float2Half(scale);
        }

        // Unlock to upload to GPU
        this._lutTexture.unlock();
    }

    getShaderGLSL() {
        return shaderGLSL;
    }

    getShaderWGSL() {
        return shaderWGSL;
    }

    updateEffect(effectTime, dt) {
        // Generate LUT with all tint/scale values pre-computed
        this.generateLUT();

        // Set LUT texture uniform
        this.setUniform('uLUT', this._lutTexture);

        // Set AABB uniforms (needed for UV calculation)
        this._aabbMinArray[0] = this.aabbMin.x;
        this._aabbMinArray[1] = this.aabbMin.y;
        this._aabbMinArray[2] = this.aabbMin.z;
        this.setUniform('uAabbMin', this._aabbMinArray);

        this._aabbMaxArray[0] = this.aabbMax.x;
        this._aabbMaxArray[1] = this.aabbMax.y;
        this._aabbMaxArray[2] = this.aabbMax.z;
        this.setUniform('uAabbMax', this._aabbMaxArray);

        // Set direction uniform (needed for UV calculation)
        this._directionArray[0] = this.direction.x;
        this._directionArray[1] = this.direction.y;
        this._directionArray[2] = this.direction.z;
        this.setUniform('uDirection', this._directionArray);
    }

    destroy() {
        // Clean up LUT texture
        if (this._lutTexture) {
            this._lutTexture.destroy();
            this._lutTexture = null;
        }

        // Call parent destroy
        super.destroy();
    }
}

export { GSplatBoxShaderEffect };
