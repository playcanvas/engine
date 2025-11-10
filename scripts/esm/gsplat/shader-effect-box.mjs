import { Vec3, Color, FloatPacking, Texture, PIXELFORMAT_RGBA16U } from 'playcanvas';
import { GsplatShaderEffect } from './gsplat-shader-effect.mjs';

const shaderGLSL = /* glsl */`
uniform highp usampler2D uLUT;
uniform vec3 uAabbMin;
uniform vec3 uAabbMax;
uniform vec3 uDirection;

// Global state for shader
bool g_insideAABB;
uvec4 g_lutValue;

void modifyCenter(inout vec3 center) {
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

void modifyCovariance(vec3 originalCenter, vec3 modifiedCenter, inout vec3 covA, inout vec3 covB) {
    if (!g_insideAABB) return;
    
    // Unpack scale from alpha channel (unpack 16-bit uint to half-float)
    float scale = unpackHalf2x16(g_lutValue.a).x;
    
    // If scale is 0, make invisible
    if (scale < 0.01) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // If scale is less than 1, progressively scale the covariance
    if (scale < 1.0) {
        covA *= scale;
        covB *= scale;
    }
}

void modifyColor(vec3 center, inout vec4 color) {
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

fn modifyCenter(center: ptr<function, vec3f>) {
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

fn modifyCovariance(originalCenter: vec3f, modifiedCenter: vec3f, covA: ptr<function, vec3f>, covB: ptr<function, vec3f>) {
    if (!g_insideAABB) { return; }
    
    // Unpack scale from alpha channel (unpack 16-bit uint to half-float)
    let scale = unpack2x16float(g_lutValue.a).x;
    
    // If scale is 0, make invisible
    if (scale < 0.01) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // If scale is less than 1, progressively scale the covariance
    if (scale < 1.0) {
        (*covA) = (*covA) * scale;
        (*covB) = (*covB) * scale;
    }
}

fn modifyColor(center: vec3f, color: ptr<function, vec4f>) {
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
 * const boxScript = entity.script.create(GsplatBoxShaderEffect);
 * boxScript.aabbMin.set(-1, -1, -1);
 * boxScript.aabbMax.set(1, 1, 1);
 */
class GsplatBoxShaderEffect extends GsplatShaderEffect {
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

    _aheadTint = new Vec3();

    _behindTint = new Vec3();

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
     * Duration for plane to sweep through the box
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
            name: 'GsplatEffectLUT',
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

        const planeProgress = Math.max(0.0, Math.min(1.0, this.effectTime / Math.max(this.duration, 0.001)));

        // Calculate box size and box length along direction
        this._boxSize.sub2(this.aabbMax, this.aabbMin);
        const boxLength = this._boxSize.dot(this._absDir);

        const edgeDistance = (this.interval / Math.max(this.duration, 0.001)) * boxLength;

        const directionSign = this._normDir.x + this._normDir.y + this._normDir.z;
        const isNegativeDir = directionSign < 0.0;

        const planePos = isNegativeDir ? ((1.0 - planeProgress) * boxLength) : (planeProgress * boxLength);

        const isTintOnlyMode = Math.abs((this.visibleStart ? 1.0 : 0.0) - (this.visibleEnd ? 1.0 : 0.0)) < 0.01;
        const invert = this.invertTint;

        // For each position along sweep direction (0 = aabbMin, 1 = aabbMax along direction)
        for (let i = 0; i < 256; i++) {
            const t = i / 255.0;
            const splatPos = t * boxLength;
            const distToPlane = splatPos - planePos;

            // Pre-compute interpolation factors
            const tBack = Math.max(0.0, Math.min(1.0, (distToPlane + edgeDistance) / edgeDistance));
            const tFront = Math.max(0.0, Math.min(1.0, distToPlane / edgeDistance));

            // Compute scale (for reveal/hide modes)
            let scale = 1.0;
            if (!isTintOnlyMode) {
                if (isNegativeDir) {
                    if (tBack < 1.0 && distToPlane < 0.0) {
                        const visStart = this.visibleStart ? 1.0 : 0.0;
                        const visEnd = this.visibleEnd ? 1.0 : 0.0;
                        scale = visStart + (visEnd - visStart) * tBack;
                    } else {
                        scale = (distToPlane < -edgeDistance) ? (this.visibleStart ? 1.0 : 0.0) : (this.visibleEnd ? 1.0 : 0.0);
                    }
                } else {
                    if (tFront < 1.0 && distToPlane >= 0.0) {
                        const visStart = this.visibleStart ? 1.0 : 0.0;
                        const visEnd = this.visibleEnd ? 1.0 : 0.0;
                        scale = visEnd + (visStart - visEnd) * tFront;
                    } else {
                        scale = (distToPlane < 0.0) ? (this.visibleEnd ? 1.0 : 0.0) : (this.visibleStart ? 1.0 : 0.0);
                    }
                }
            }

            // Compute tint color (RGB) - start with baseTint, then multiply by additional tint
            this._additionalTint.set(1, 1, 1);

            if (isTintOnlyMode) {
                // Tint-only mode: determine which tint to use based on position
                // Determine if we're ahead or behind plane (accounting for direction)
                const isAhead = isNegativeDir ? (distToPlane < 0.0) : (distToPlane > 0.0);
                const distAbs = Math.abs(distToPlane);

                // Determine which tints to use based on invert flag
                if (invert) {
                    this._aheadTint.set(this.tint.r, this.tint.g, this.tint.b);
                    this._behindTint.set(1, 1, 1);
                } else {
                    this._aheadTint.set(1, 1, 1);
                    this._behindTint.set(this.tint.r, this.tint.g, this.tint.b);
                }

                if (distAbs > edgeDistance) {
                    // Outside edge interval
                    if (isAhead) {
                        this._additionalTint.copy(this._aheadTint);
                    } else {
                        this._additionalTint.copy(this._behindTint);
                    }
                } else {
                    // Within edge interval - interpolate through edgeTint
                    const t = distAbs / edgeDistance; // 0 at plane, 1 at edge
                    this._edgeTintVec.set(this.edgeTint.r, this.edgeTint.g, this.edgeTint.b);
                    if (isAhead) {
                        // Interpolate from edge tint to ahead tint
                        this._additionalTint.lerp(this._edgeTintVec, this._aheadTint, t);
                    } else {
                        // Interpolate from behind tint to edge tint
                        this._additionalTint.lerp(this._behindTint, this._edgeTintVec, t);
                    }
                }
            } else {
                // Reveal/hide mode: interpolate between tint and edgeTint
                const edgeFactor = (tBack < 1.0 && distToPlane < 0.0) ?
                    tBack :
                    (distToPlane < -edgeDistance ? 0.0 : 1.0);

                this._tintVec.set(this.tint.r, this.tint.g, this.tint.b);
                this._edgeTintVec.set(this.edgeTint.r, this.edgeTint.g, this.edgeTint.b);
                this._additionalTint.lerp(this._tintVec, this._edgeTintVec, edgeFactor);
            }

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

export { GsplatBoxShaderEffect };
