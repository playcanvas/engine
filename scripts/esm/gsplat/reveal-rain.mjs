import { Vec3, Color } from 'playcanvas';
import { GsplatRevealBase } from './reveal-base.mjs';

const shaderGLSL = /* glsl */`
uniform float uTime;
uniform vec3 uCenter;
uniform float uDistance;
uniform float uSpeed;
uniform float uAcceleration;
uniform float uFlightTime;
uniform float uRainSize;
uniform float uRotation;
uniform vec3 uFallTint;
uniform float uFallTintIntensity;
uniform vec3 uHitTint;
uniform float uHitDuration;
uniform float uEndRadius;

// Shared globals (initialized once per vertex)
float g_dist2D;
float g_dist3D;
float g_tStart;
float g_tLand;

// Solve: distance = speed * t + 0.5 * acceleration * t²
float solveWaveTime(float dist) {
    if (uAcceleration == 0.0) {
        return dist / uSpeed;
    } else {
        // Quadratic formula: t = (-v + sqrt(v² + 2ad)) / a
        float discriminant = uSpeed * uSpeed + 2.0 * uAcceleration * dist;
        return (-uSpeed + sqrt(max(discriminant, 0.0))) / uAcceleration;
    }
}

void initShared(vec3 center) {
    vec2 center2D = center.xz;
    vec2 origin2D = uCenter.xz;
    g_dist2D = length(center2D - origin2D);
    g_dist3D = length(center - uCenter);
    g_tStart = solveWaveTime(g_dist2D);
    g_tLand = g_tStart + uFlightTime;
}

void modifyCenter(inout vec3 center) {
    vec3 originalCenter = center;
    initShared(center);
    
    // Check if animation is complete (after landing transition)
    float timeSinceLanding = uTime - g_tLand;
    if (timeSinceLanding >= 0.5) return; // Effect complete, no modifications
    
    // Early exit optimization during animation
    if (g_dist3D > uEndRadius) return;
    
    // If not started yet, do nothing (will be invisible)
    if (uTime < g_tStart) return;
    
    // If falling: interpolate Y from elevated to original and apply rotation
    if (uTime < g_tLand) {
        float fallProgress = (uTime - g_tStart) / (g_tLand - g_tStart);
        
        // Vertical movement
        center.y += uDistance * (1.0 - fallProgress);
        
        // Rotation around Y axis through uCenter
        float angle = fallProgress * uRotation * 6.283185; // uRotation * 2π
        vec3 offset = originalCenter - uCenter;
        float cosAngle = cos(angle);
        float sinAngle = sin(angle);
        offset.x = originalCenter.x - uCenter.x;
        offset.z = originalCenter.z - uCenter.z;
        center.x = uCenter.x + offset.x * cosAngle - offset.z * sinAngle;
        center.z = uCenter.z + offset.x * sinAngle + offset.z * cosAngle;
    }
    // If landed: stay at original position (no change needed)
}

void modifyCovariance(vec3 originalCenter, vec3 modifiedCenter, inout vec3 covA, inout vec3 covB) {
    // Check if animation is complete (after landing transition)
    float timeSinceLanding = uTime - g_tLand;
    if (timeSinceLanding >= 0.5) return; // Effect complete, no modifications
    
    // Early exit for distant splats during animation
    if (g_dist3D > uEndRadius) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // Before 2D wave reaches: invisible
    if (uTime < g_tStart) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // During fall and transition after landing
    if (timeSinceLanding < 0.5) {
        // Still falling or transitioning
        float originalSize = gsplatExtractSize(covA, covB);
        
        if (timeSinceLanding < 0.0) {
            // Falling: small round dots
            gsplatMakeRound(covA, covB, min(uRainSize, originalSize));
        } else {
            // Landing transition: lerp from dots to original over 0.5s
            float t = timeSinceLanding * 2.0; // normalize [0, 0.5] to [0, 1]
            float size = mix(uRainSize, originalSize, t);
            
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
    float timeSinceLanding = uTime - g_tLand;
    if (timeSinceLanding >= uHitDuration) return; // Effect complete, no modifications
    
    // Early exit for distant splats during animation
    if (g_dist3D > uEndRadius) return;
    
    // Before wave reaches: no color change (invisible anyway)
    if (uTime < g_tStart) return;
    
    if (timeSinceLanding < 0.0) {
        // Falling: blend between original and fall tint
        color.rgb = mix(color.rgb, uFallTint, uFallTintIntensity);
    } else if (timeSinceLanding < uHitDuration) {
        // Landing: apply hit tint, fade out
        float fadeOut = 1.0 - (timeSinceLanding / uHitDuration);
        color.rgb += uHitTint * fadeOut;
    }
    // After hit duration: original color (no change)
}
`;

const shaderWGSL = /* wgsl */`
uniform uTime: f32;
uniform uCenter: vec3f;
uniform uDistance: f32;
uniform uSpeed: f32;
uniform uAcceleration: f32;
uniform uFlightTime: f32;
uniform uRainSize: f32;
uniform uRotation: f32;
uniform uFallTint: vec3f;
uniform uFallTintIntensity: f32;
uniform uHitTint: vec3f;
uniform uHitDuration: f32;
uniform uEndRadius: f32;

// Shared globals (initialized once per vertex)
var<private> g_dist2D: f32;
var<private> g_dist3D: f32;
var<private> g_tStart: f32;
var<private> g_tLand: f32;

// Solve: distance = speed * t + 0.5 * acceleration * t²
fn solveWaveTime(dist: f32) -> f32 {
    if (uniform.uAcceleration == 0.0) {
        return dist / uniform.uSpeed;
    } else {
        // Quadratic formula: t = (-v + sqrt(v² + 2ad)) / a
        let discriminant = uniform.uSpeed * uniform.uSpeed + 2.0 * uniform.uAcceleration * dist;
        return (-uniform.uSpeed + sqrt(max(discriminant, 0.0))) / uniform.uAcceleration;
    }
}

fn initShared(center: vec3f) {
    let center2D = center.xz;
    let origin2D = uniform.uCenter.xz;
    g_dist2D = length(center2D - origin2D);
    g_dist3D = length(center - uniform.uCenter);
    g_tStart = solveWaveTime(g_dist2D);
    g_tLand = g_tStart + uniform.uFlightTime;
}

fn modifyCenter(center: ptr<function, vec3f>) {
    let originalCenter = *center;
    initShared(*center);
    
    // Check if animation is complete (after landing transition)
    let timeSinceLanding = uniform.uTime - g_tLand;
    if (timeSinceLanding >= 0.5) {
        return; // Effect complete, no modifications
    }
    
    // Early exit optimization during animation
    if (g_dist3D > uniform.uEndRadius) {
        return;
    }
    
    // If not started yet, do nothing (will be invisible)
    if (uniform.uTime < g_tStart) {
        return;
    }
    
    // If falling: interpolate Y from elevated to original and apply rotation
    if (uniform.uTime < g_tLand) {
        let fallProgress = (uniform.uTime - g_tStart) / (g_tLand - g_tStart);
        
        // Vertical movement
        (*center).y += uniform.uDistance * (1.0 - fallProgress);
        
        // Rotation around Y axis through uCenter
        let angle = fallProgress * uniform.uRotation * 6.283185; // uRotation * 2π
        let offset = originalCenter - uniform.uCenter;
        let cosAngle = cos(angle);
        let sinAngle = sin(angle);
        let offsetX = originalCenter.x - uniform.uCenter.x;
        let offsetZ = originalCenter.z - uniform.uCenter.z;
        (*center).x = uniform.uCenter.x + offsetX * cosAngle - offsetZ * sinAngle;
        (*center).z = uniform.uCenter.z + offsetX * sinAngle + offsetZ * cosAngle;
    }
    // If landed: stay at original position (no change needed)
}

fn modifyCovariance(originalCenter: vec3f, modifiedCenter: vec3f, covA: ptr<function, vec3f>, covB: ptr<function, vec3f>) {
    // Check if animation is complete (after landing transition)
    let timeSinceLanding = uniform.uTime - g_tLand;
    if (timeSinceLanding >= 0.5) {
        return; // Effect complete, no modifications
    }
    
    // Early exit for distant splats during animation
    if (g_dist3D > uniform.uEndRadius) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // Before 2D wave reaches: invisible
    if (uniform.uTime < g_tStart) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // During fall and transition after landing
    if (timeSinceLanding < 0.5) {
        // Still falling or transitioning
        let originalSize = gsplatExtractSize(*covA, *covB);
        
        if (timeSinceLanding < 0.0) {
            // Falling: small round dots
            gsplatMakeRound(covA, covB, min(uniform.uRainSize, originalSize));
        } else {
            // Landing transition: lerp from dots to original over 0.5s
            let t = timeSinceLanding * 2.0; // normalize [0, 0.5] to [0, 1]
            let size = mix(uniform.uRainSize, originalSize, t);
            
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
    let timeSinceLanding = uniform.uTime - g_tLand;
    if (timeSinceLanding >= uniform.uHitDuration) {
        return; // Effect complete, no modifications
    }
    
    // Early exit for distant splats during animation
    if (g_dist3D > uniform.uEndRadius) {
        return;
    }
    
    // Before wave reaches: no color change (invisible anyway)
    if (uniform.uTime < g_tStart) {
        return;
    }
    
    if (timeSinceLanding < 0.0) {
        // Falling: blend between original and fall tint
        (*color) = vec4f(mix((*color).rgb, uniform.uFallTint, uniform.uFallTintIntensity), (*color).a);
    } else if (timeSinceLanding < uniform.uHitDuration) {
        // Landing: apply hit tint, fade out
        let fadeOut = 1.0 - (timeSinceLanding / uniform.uHitDuration);
        (*color) = vec4f((*color).rgb + uniform.uHitTint * fadeOut, (*color).a);
    }
    // After hit duration: original color (no change)
}
`;

/**
 * Rain reveal effect for gaussian splats.
 * Splats appear as small dots at an elevated position and fall down to land
 * when an expanding 3D sphere wave reaches them.
 *
 * @example
 * // Add the script to a gsplat entity
 * entity.addComponent('script');
 * const rainScript = entity.script.create(GsplatRevealRain);
 * rainScript.center.set(0, 0, 0);
 * rainScript.distance = 5;
 * rainScript.speed = 3;
 */
class GsplatRevealRain extends GsplatRevealBase {
    static scriptName = 'gsplatRevealRain';

    // Reusable arrays for uniform updates
    _centerArray = [0, 0, 0];

    _fallTintArray = [0, 0, 0];

    _hitTintArray = [0, 0, 0];

    /**
     * Origin point for the wave
     * @attribute
     */
    center = new Vec3(0, 0, 0);

    /**
     * Elevation above target position where splats start
     * @attribute
     * @range [0, 50]
     */
    distance = 30;

    /**
     * Wave speed in units/second
     * @attribute
     * @range [0, 10]
     */
    speed = 2;

    /**
     * Speed increase over time
     * @attribute
     * @range [0, 5]
     */
    acceleration = 0;

    /**
     * Duration of fall in seconds
     * @attribute
     * @range [0.1, 5]
     */
    flightTime = 2;

    /**
     * Size of particles while falling
     * @attribute
     * @range [0, 0.1]
     */
    rainSize = 0.015;

    /**
     * Rotation amount during fall (fraction of full circle, 0.9 = 90%)
     * @attribute
     * @range [0, 2]
     */
    rotation = 0.9;

    /**
     * Color during fall
     * @attribute
     */
    fallTint = new Color(0, 1, 1);

    /**
     * Blend intensity between original color and fall tint (0=original, 1=full tint)
     * @attribute
     * @range [0, 1]
     */
    fallTintIntensity = 0.2;

    /**
     * Additive color on landing (flash)
     * @attribute
     */
    hitTint = new Color(2, 0, 0);

    /**
     * Duration of hit tint flash in seconds
     * @attribute
     * @range [0, 2]
     */
    hitDuration = 0.5;

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
            uDistance: 30,
            uSpeed: 2,
            uAcceleration: 0,
            uFlightTime: 2,
            uRainSize: 0.015,
            uRotation: 0.9,
            uFallTint: [0, 1, 1],
            uFallTintIntensity: 0.2,
            uHitTint: [2, 0, 0],
            uHitDuration: 0.5,
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

        uniforms.uDistance.setValue(this.distance);
        uniforms.uSpeed.setValue(this.speed);
        uniforms.uAcceleration.setValue(this.acceleration);
        uniforms.uFlightTime.setValue(this.flightTime);
        uniforms.uRainSize.setValue(this.rainSize);
        uniforms.uRotation.setValue(this.rotation);

        this._fallTintArray[0] = this.fallTint.r;
        this._fallTintArray[1] = this.fallTint.g;
        this._fallTintArray[2] = this.fallTint.b;
        uniforms.uFallTint.setValue(this._fallTintArray);
        uniforms.uFallTintIntensity.setValue(this.fallTintIntensity);

        this._hitTintArray[0] = this.hitTint.r;
        this._hitTintArray[1] = this.hitTint.g;
        this._hitTintArray[2] = this.hitTint.b;
        uniforms.uHitTint.setValue(this._hitTintArray);

        uniforms.uHitDuration.setValue(this.hitDuration);
        uniforms.uEndRadius.setValue(this.endRadius);
    }

    /**
     * Calculate when the effect is complete.
     * Effect completes when the furthest splat within endRadius has finished animating.
     * @returns {boolean} True if effect is complete
     */
    isEffectComplete() {
        if (!this.currentTime) return false;

        // Calculate time for furthest splat within endRadius
        let maxTStart;
        if (this.acceleration === 0) {
            maxTStart = this.endRadius / this.speed;
        } else {
            // Quadratic formula: t = (-v + sqrt(v² + 2ad)) / a
            const discriminant = this.speed * this.speed + 2.0 * this.acceleration * this.endRadius;
            maxTStart = (-this.speed + Math.sqrt(Math.max(discriminant, 0.0))) / this.acceleration;
        }

        const maxTLand = maxTStart + this.flightTime;
        const maxCompletionTime = maxTLand + Math.max(0.5, this.hitDuration);

        return this.currentTime >= maxCompletionTime;
    }
}

export { GsplatRevealRain };
