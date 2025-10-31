import { Vec3, Color } from 'playcanvas';
import { GsplatRevealBase } from './reveal-base.mjs';

const shaderGLSL = /* glsl */`
uniform float uTime;
uniform vec3 uCenter;
uniform float uBlockCount;
uniform float uBlockSize;
uniform float uDelay;
uniform float uDuration;
uniform float uDotSize;
uniform vec3 uMoveTint;
uniform float uMoveTintIntensity;
uniform vec3 uLandTint;
uniform float uLandDuration;
uniform float uEndRadius;

// Shared globals (initialized once per vertex)
float g_blockDist;
float g_tStart;
float g_tEnd;

void initShared(vec3 center) {
    // Determine which block this splat belongs to
    vec3 offset = center - uCenter;
    ivec3 blockIdx = ivec3(floor(offset / uBlockSize + vec3(uBlockCount * 0.5)));
    
    // Calculate block center position
    vec3 blockCenter = (vec3(blockIdx) - vec3(uBlockCount * 0.5) + vec3(0.5)) * uBlockSize + uCenter;
    
    // Euclidean distance from center block
    g_blockDist = length(blockCenter - uCenter);
    g_tStart = g_blockDist * uDelay;
    g_tEnd = g_tStart + uDuration;
}

void modifyCenter(inout vec3 center) {
    vec3 originalCenter = center;
    initShared(center);
    
    // Check if animation is complete (after landing transition)
    float timeSinceLanding = uTime - g_tEnd;
    if (timeSinceLanding >= 0.3) return; // Effect complete, no modifications
    
    // Early exit optimization during animation
    if (g_blockDist > uEndRadius) return;
    
    // Before movement starts: position at center point
    if (uTime < g_tStart) {
        center = uCenter;
        return;
    }
    
    // During movement: lerp from center to original position
    if (uTime < g_tEnd) {
        float progress = (uTime - g_tStart) / uDuration;
        center = mix(uCenter, originalCenter, progress);
    }
    // After movement: original position (no change needed)
}

void modifyCovariance(vec3 originalCenter, vec3 modifiedCenter, inout vec3 covA, inout vec3 covB) {
    // Check if animation is complete (after landing transition)
    float timeSinceLanding = uTime - g_tEnd;
    if (timeSinceLanding >= 0.3) return; // Effect complete, no modifications
    
    // Early exit for distant splats during animation
    if (g_blockDist > uEndRadius) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // Before movement: invisible
    if (uTime < g_tStart) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // During landing transition after movement
    if (timeSinceLanding < 0.3) {
        float originalSize = gsplatExtractSize(covA, covB);
        
        if (timeSinceLanding < 0.0) {
            // During movement: small round dots
            gsplatMakeRound(covA, covB, min(uDotSize, originalSize));
        } else {
            // Landing transition: lerp from dots to original over 0.3s
            float t = timeSinceLanding * 3.333333; // normalize [0, 0.3] to [0, 1]
            float size = mix(uDotSize, originalSize, t);
            
            // Lerp between round and original shape
            vec3 origCovA = covA;
            vec3 origCovB = covB;
            gsplatMakeRound(covA, covB, size);
            covA = mix(covA, origCovA, t);
            covB = mix(covB, origCovB, t);
        }
    }
    // After transition: original shape/size (no-op)
}

void modifyColor(vec3 center, inout vec4 color) {
    // Check if animation is complete
    float timeSinceLanding = uTime - g_tEnd;
    if (timeSinceLanding >= uLandDuration) return; // Effect complete, no modifications
    
    // Early exit for distant splats during animation
    if (g_blockDist > uEndRadius) return;
    
    // Before movement: no change
    if (uTime < g_tStart) return;
    
    if (timeSinceLanding < 0.0) {
        // During movement: blend between original and moveTint
        color.rgb = mix(color.rgb, uMoveTint, uMoveTintIntensity);
    } else if (timeSinceLanding < uLandDuration) {
        // Landing: apply landTint with fadeout
        float fadeOut = 1.0 - (timeSinceLanding / uLandDuration);
        color.rgb += uLandTint * fadeOut;
    }
    // After landing: original color (no change)
}
`;

const shaderWGSL = /* wgsl */`
uniform uTime: f32;
uniform uCenter: vec3f;
uniform uBlockCount: f32;
uniform uBlockSize: f32;
uniform uDelay: f32;
uniform uDuration: f32;
uniform uDotSize: f32;
uniform uMoveTint: vec3f;
uniform uMoveTintIntensity: f32;
uniform uLandTint: vec3f;
uniform uLandDuration: f32;
uniform uEndRadius: f32;

// Shared globals (initialized once per vertex)
var<private> g_blockDist: f32;
var<private> g_tStart: f32;
var<private> g_tEnd: f32;

fn initShared(center: vec3f) {
    // Determine which block this splat belongs to
    let offset = center - uniform.uCenter;
    let blockIdx = vec3i(floor(offset / uniform.uBlockSize + vec3f(uniform.uBlockCount * 0.5)));
    
    // Calculate block center position
    let blockCenter = (vec3f(blockIdx) - vec3f(uniform.uBlockCount * 0.5) + vec3f(0.5)) * uniform.uBlockSize + uniform.uCenter;
    
    // Euclidean distance from center block
    g_blockDist = length(blockCenter - uniform.uCenter);
    g_tStart = g_blockDist * uniform.uDelay;
    g_tEnd = g_tStart + uniform.uDuration;
}

fn modifyCenter(center: ptr<function, vec3f>) {
    let originalCenter = *center;
    initShared(*center);
    
    // Check if animation is complete (after landing transition)
    let timeSinceLanding = uniform.uTime - g_tEnd;
    if (timeSinceLanding >= 0.3) {
        return; // Effect complete, no modifications
    }
    
    // Early exit optimization during animation
    if (g_blockDist > uniform.uEndRadius) {
        return;
    }
    
    // Before movement starts: position at center point
    if (uniform.uTime < g_tStart) {
        *center = uniform.uCenter;
        return;
    }
    
    // During movement: lerp from center to original position
    if (uniform.uTime < g_tEnd) {
        let progress = (uniform.uTime - g_tStart) / uniform.uDuration;
        *center = mix(uniform.uCenter, originalCenter, progress);
    }
    // After movement: original position (no change needed)
}

fn modifyCovariance(originalCenter: vec3f, modifiedCenter: vec3f, covA: ptr<function, vec3f>, covB: ptr<function, vec3f>) {
    // Check if animation is complete (after landing transition)
    let timeSinceLanding = uniform.uTime - g_tEnd;
    if (timeSinceLanding >= 0.3) {
        return; // Effect complete, no modifications
    }
    
    // Early exit for distant splats during animation
    if (g_blockDist > uniform.uEndRadius) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // Before movement: invisible
    if (uniform.uTime < g_tStart) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // During landing transition after movement
    if (timeSinceLanding < 0.3) {
        let originalSize = gsplatExtractSize(*covA, *covB);
        
        if (timeSinceLanding < 0.0) {
            // During movement: small round dots
            gsplatMakeRound(covA, covB, min(uniform.uDotSize, originalSize));
        } else {
            // Landing transition: lerp from dots to original over 0.3s
            let t = timeSinceLanding * 3.333333; // normalize [0, 0.3] to [0, 1]
            let size = mix(uniform.uDotSize, originalSize, t);
            
            // Lerp between round and original shape
            let origCovA = *covA;
            let origCovB = *covB;
            gsplatMakeRound(covA, covB, size);
            *covA = mix(*covA, origCovA, t);
            *covB = mix(*covB, origCovB, t);
        }
    }
    // After transition: original shape/size (no-op)
}

fn modifyColor(center: vec3f, color: ptr<function, vec4f>) {
    // Check if animation is complete
    let timeSinceLanding = uniform.uTime - g_tEnd;
    if (timeSinceLanding >= uniform.uLandDuration) {
        return; // Effect complete, no modifications
    }
    
    // Early exit for distant splats during animation
    if (g_blockDist > uniform.uEndRadius) {
        return;
    }
    
    // Before movement: no change
    if (uniform.uTime < g_tStart) {
        return;
    }
    
    if (timeSinceLanding < 0.0) {
        // During movement: blend between original and moveTint
        (*color) = vec4f(mix((*color).rgb, uniform.uMoveTint, uniform.uMoveTintIntensity), (*color).a);
    } else if (timeSinceLanding < uniform.uLandDuration) {
        // Landing: apply landTint with fadeout
        let fadeOut = 1.0 - (timeSinceLanding / uniform.uLandDuration);
        (*color) = vec4f((*color).rgb + uniform.uLandTint * fadeOut, (*color).a);
    }
    // After landing: original color (no change)
}
`;

/**
 * Grid Eruption reveal effect for gaussian splats.
 * Splats shoot out from a center point in blocks based on a 3D grid,
 * with blocks animating in order of their distance from center.
 *
 * @example
 * // Add the script to a gsplat entity
 * entity.addComponent('script');
 * const gridScript = entity.script.create(GsplatRevealGridEruption);
 * gridScript.center.set(0, 0, 0);
 * gridScript.blockCount = 10;
 */
class GsplatRevealGridEruption extends GsplatRevealBase {
    static scriptName = 'gsplatRevealGridEruption';

    // Reusable arrays for uniform updates
    _centerArray = [0, 0, 0];

    _moveTintArray = [0, 0, 0];

    _landTintArray = [0, 0, 0];

    /**
     * Origin point for the eruption
     * @attribute
     */
    center = new Vec3(0, 0, 0);

    /**
     * Grid divisions per dimension
     * @attribute
     * @range [2, 20]
     */
    blockCount = 10;

    /**
     * Size of each grid block
     * @attribute
     * @range [0.1, 10]
     */
    blockSize = 2;

    /**
     * Time between successive blocks starting (seconds)
     * @attribute
     * @range [0, 2]
     */
    delay = 0.2;

    /**
     * Time to reach final position (seconds)
     * @attribute
     * @range [0.1, 4]
     */
    duration = 1.0;

    /**
     * Size of particles during movement
     * @attribute
     * @range [0, 0.1]
     */
    dotSize = 0.01;

    /**
     * Color during movement
     * @attribute
     */
    moveTint = new Color(1, 0, 1);

    /**
     * Blend intensity between original color and movement tint (0=original, 1=full tint)
     * @attribute
     * @range [0, 1]
     */
    moveTintIntensity = 0.2;

    /**
     * Additive color on landing (flash)
     * @attribute
     */
    landTint = new Color(2, 2, 0);

    /**
     * Duration of landing tint flash in seconds
     * @attribute
     * @range [0, 4]
     */
    landDuration = 0.6;

    /**
     * Distance at which to disable effect for performance
     * @attribute
     * @range [0, 500]
     */
    endRadius = 25;

    getShaderGLSL() {
        return shaderGLSL;
    }

    getShaderWGSL() {
        return shaderWGSL;
    }

    getUniforms() {
        return {
            uCenter: [0, 0, 0],
            uBlockCount: 10,
            uBlockSize: 2,
            uDelay: 0.2,
            uDuration: 1.0,
            uDotSize: 0.01,
            uMoveTint: [1, 0, 1],
            uMoveTintIntensity: 0.2,
            uLandTint: [2, 2, 0],
            uLandDuration: 0.6,
            uEndRadius: 25
        };
    }

    updateUniforms(dt) {
        const { uniforms } = this;
        if (!uniforms) return;

        this._centerArray[0] = this.center.x;
        this._centerArray[1] = this.center.y;
        this._centerArray[2] = this.center.z;
        uniforms.uCenter.setValue(this._centerArray);

        uniforms.uBlockCount.setValue(this.blockCount);
        uniforms.uBlockSize.setValue(this.blockSize);
        uniforms.uDelay.setValue(this.delay);
        uniforms.uDuration.setValue(this.duration);
        uniforms.uDotSize.setValue(this.dotSize);

        this._moveTintArray[0] = this.moveTint.r;
        this._moveTintArray[1] = this.moveTint.g;
        this._moveTintArray[2] = this.moveTint.b;
        uniforms.uMoveTint.setValue(this._moveTintArray);
        uniforms.uMoveTintIntensity.setValue(this.moveTintIntensity);

        this._landTintArray[0] = this.landTint.r;
        this._landTintArray[1] = this.landTint.g;
        this._landTintArray[2] = this.landTint.b;
        uniforms.uLandTint.setValue(this._landTintArray);

        uniforms.uLandDuration.setValue(this.landDuration);
        uniforms.uEndRadius.setValue(this.endRadius);
    }

    /**
     * Calculate when the effect is complete.
     * Effect completes when the furthest block within endRadius has finished animating.
     * @returns {boolean} True if effect is complete
     */
    isEffectComplete() {
        if (!this.currentTime) return false;

        // Calculate time for furthest block within endRadius
        const maxTStart = this.endRadius * this.delay;
        const maxTEnd = maxTStart + this.duration;
        const maxCompletionTime = maxTEnd + Math.max(0.3, this.landDuration);

        return this.currentTime >= maxCompletionTime;
    }
}

export { GsplatRevealGridEruption };
