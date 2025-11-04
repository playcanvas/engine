import { Vec3, Color } from 'playcanvas';
import { GsplatRevealBase } from './reveal-base.mjs';

const shaderGLSL = /* glsl */`
uniform float uTime;
uniform vec3 uCenter;
uniform float uSpeed;
uniform float uAcceleration;
uniform float uDelay;
uniform vec3 uDotTint;
uniform vec3 uWaveTint;
uniform float uOscillationIntensity;
uniform float uEndRadius;

// Shared globals (initialized once per vertex)
float g_dist;
float g_dotWavePos;
float g_liftTime;
float g_liftWavePos;

void initShared(vec3 center) {
    g_dist = length(center - uCenter);
    g_dotWavePos = uSpeed * uTime + 0.5 * uAcceleration * uTime * uTime;
    g_liftTime = max(0.0, uTime - uDelay);
    g_liftWavePos = uSpeed * g_liftTime + 0.5 * uAcceleration * g_liftTime * g_liftTime;
}

// Hash function for per-splat randomization
float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

void modifyCenter(inout vec3 center) {
    initShared(center);
    
    // Early exit optimization
    if (g_dist > uEndRadius) return;
    
    // Only apply oscillation if lift wave hasn't fully passed
    bool wavesActive = g_liftTime <= 0.0 || g_dist > g_liftWavePos - 1.5;
    if (wavesActive) {
        // Apply oscillation with per-splat phase offset
        float phase = hash(center) * 6.28318;
        center.y += sin(uTime * 3.0 + phase) * uOscillationIntensity * 0.25;
    }
    
    // Apply lift effect near the wave edge
    float distToLiftWave = abs(g_dist - g_liftWavePos);
    if (distToLiftWave < 1.0 && g_liftTime > 0.0) {
        // Create a smooth lift curve (peaks at wave edge)
        // Lift is 0.9x the oscillation intensity (30% of original 3x)
        float liftAmount = (1.0 - distToLiftWave) * sin(distToLiftWave * 3.14159);
        center.y += liftAmount * uOscillationIntensity * 0.9;
    }
}

void modifyCovariance(vec3 originalCenter, vec3 modifiedCenter, inout vec3 covA, inout vec3 covB) {
    // Early exit for distant splats - hide them
    if (g_dist > uEndRadius) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // Determine scale and phase
    float scale;
    bool isLiftWave = g_liftTime > 0.0 && g_liftWavePos > g_dist;
    
    if (isLiftWave) {
        // Lift wave: transition from dots to full size
        scale = (g_liftWavePos >= g_dist + 2.0) ? 1.0 : mix(0.1, 1.0, (g_liftWavePos - g_dist) * 0.5);
    } else if (g_dist > g_dotWavePos + 1.0) {
        // Before dot wave: invisible
        gsplatMakeRound(covA, covB, 0.0);
        return;
    } else if (g_dist > g_dotWavePos - 1.0) {
        // Dot wave front: scale from 0 to 0.1 with 2x peak at center
        float distToWave = abs(g_dist - g_dotWavePos);
        scale = (distToWave < 0.5) 
            ? mix(0.1, 0.2, 1.0 - distToWave * 2.0)
            : mix(0.0, 0.1, smoothstep(g_dotWavePos + 1.0, g_dotWavePos - 1.0, g_dist));
    } else {
        // After dot wave, before lift: small dots
        scale = 0.1;
    }
    
    // Apply scale to covariance
    if (scale >= 1.0) {
        // Fully revealed: original shape and size (no-op)
        return;
    } else if (isLiftWave) {
        // Lift wave: lerp from round dots to original shape
        float t = (scale - 0.1) * 1.111111; // normalize [0.1, 1.0] to [0, 1]
        float dotSize = scale * 0.05;
        float originalSize = gsplatExtractSize(covA, covB);
        float finalSize = mix(dotSize, originalSize, t);
        
        // Lerp between round and scaled original
        vec3 origCovA = covA * (scale * scale);
        vec3 origCovB = covB * (scale * scale);
        gsplatMakeRound(covA, covB, finalSize);
        covA = mix(covA, origCovA, t);
        covB = mix(covB, origCovB, t);
    } else {
        // Dot phase: round with absolute size, but don't make small splats larger
        float originalSize = gsplatExtractSize(covA, covB);
        gsplatMakeRound(covA, covB, min(scale * 0.05, originalSize));
    }
}

void modifyColor(vec3 center, inout vec4 color) {
    // Use shared globals
    if (g_dist > uEndRadius) return;
    
    // Lift wave tint takes priority (active during lift)
    if (g_liftTime > 0.0 && g_dist >= g_liftWavePos - 1.5 && g_dist <= g_liftWavePos + 0.5) {
        float distToLift = abs(g_dist - g_liftWavePos);
        float liftIntensity = smoothstep(1.5, 0.0, distToLift);
        color.rgb += uWaveTint * liftIntensity;
    }
    // Dot wave tint (active in dot phase, but not where lift wave is active)
    else if (g_dist <= g_dotWavePos && (g_liftTime <= 0.0 || g_dist > g_liftWavePos + 0.5)) {
        float distToDot = abs(g_dist - g_dotWavePos);
        float dotIntensity = smoothstep(1.0, 0.0, distToDot);
        color.rgb += uDotTint * dotIntensity;
    }
}
`;

const shaderWGSL = /* wgsl */`
uniform uTime: f32;
uniform uCenter: vec3f;
uniform uSpeed: f32;
uniform uAcceleration: f32;
uniform uDelay: f32;
uniform uDotTint: vec3f;
uniform uWaveTint: vec3f;
uniform uOscillationIntensity: f32;
uniform uEndRadius: f32;

// Shared globals (initialized once per vertex)
var<private> g_dist: f32;
var<private> g_dotWavePos: f32;
var<private> g_liftTime: f32;
var<private> g_liftWavePos: f32;

fn initShared(center: vec3f) {
    g_dist = length(center - uniform.uCenter);
    g_dotWavePos = uniform.uSpeed * uniform.uTime + 0.5 * uniform.uAcceleration * uniform.uTime * uniform.uTime;
    g_liftTime = max(0.0, uniform.uTime - uniform.uDelay);
    g_liftWavePos = uniform.uSpeed * g_liftTime + 0.5 * uniform.uAcceleration * g_liftTime * g_liftTime;
}

// Hash function for per-splat randomization
fn hash(p: vec3f) -> f32 {
    return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453);
}

fn modifyCenter(center: ptr<function, vec3f>) {
    initShared(*center);
    
    // Early exit optimization
    if (g_dist > uniform.uEndRadius) {
        return;
    }
    
    // Only apply oscillation if lift wave hasn't fully passed
    let wavesActive = g_liftTime <= 0.0 || g_dist > g_liftWavePos - 1.5;
    if (wavesActive) {
        // Apply oscillation with per-splat phase offset
        let phase = hash(*center) * 6.28318;
        (*center).y += sin(uniform.uTime * 3.0 + phase) * uniform.uOscillationIntensity * 0.25;
    }
    
    // Apply lift effect near the wave edge
    let distToLiftWave = abs(g_dist - g_liftWavePos);
    if (distToLiftWave < 1.0 && g_liftTime > 0.0) {
        // Create a smooth lift curve (peaks at wave edge)
        // Lift is 0.9x the oscillation intensity (30% of original 3x)
        let liftAmount = (1.0 - distToLiftWave) * sin(distToLiftWave * 3.14159);
        (*center).y += liftAmount * uniform.uOscillationIntensity * 0.9;
    }
}

fn modifyCovariance(originalCenter: vec3f, modifiedCenter: vec3f, covA: ptr<function, vec3f>, covB: ptr<function, vec3f>) {
    // Early exit for distant splats - hide them
    if (g_dist > uniform.uEndRadius) {
        gsplatMakeRound(covA, covB, 0.0);
        return;
    }
    
    // Determine scale and phase
    var scale: f32;
    let isLiftWave = g_liftTime > 0.0 && g_liftWavePos > g_dist;
    
    if (isLiftWave) {
        // Lift wave: transition from dots to full size
        scale = select(mix(0.1, 1.0, (g_liftWavePos - g_dist) * 0.5), 1.0, g_liftWavePos >= g_dist + 2.0);
    } else if (g_dist > g_dotWavePos + 1.0) {
        // Before dot wave: invisible
        gsplatMakeRound(covA, covB, 0.0);
        return;
    } else if (g_dist > g_dotWavePos - 1.0) {
        // Dot wave front: scale from 0 to 0.1 with 2x peak at center
        let distToWave = abs(g_dist - g_dotWavePos);
        scale = select(
            mix(0.0, 0.1, smoothstep(g_dotWavePos + 1.0, g_dotWavePos - 1.0, g_dist)),
            mix(0.1, 0.2, 1.0 - distToWave * 2.0),
            distToWave < 0.5
        );
    } else {
        // After dot wave, before lift: small dots
        scale = 0.1;
    }
    
    // Apply scale to covariance
    if (scale >= 1.0) {
        // Fully revealed: original shape and size (no-op)
        return;
    } else if (isLiftWave) {
        // Lift wave: lerp from round dots to original shape
        let t = (scale - 0.1) * 1.111111; // normalize [0.1, 1.0] to [0, 1]
        let dotSize = scale * 0.05;
        let originalSize = gsplatExtractSize(*covA, *covB);
        let finalSize = mix(dotSize, originalSize, t);
        
        // Lerp between round and scaled original
        let origCovA = *covA * (scale * scale);
        let origCovB = *covB * (scale * scale);
        gsplatMakeRound(covA, covB, finalSize);
        *covA = mix(*covA, origCovA, t);
        *covB = mix(*covB, origCovB, t);
    } else {
        // Dot phase: round with absolute size, but don't make small splats larger
        let originalSize = gsplatExtractSize(*covA, *covB);
        gsplatMakeRound(covA, covB, min(scale * 0.05, originalSize));
    }
}

fn modifyColor(center: vec3f, color: ptr<function, vec4f>) {
    // Use shared globals
    if (g_dist > uniform.uEndRadius) {
        return;
    }
    
    // Lift wave tint takes priority (active during lift)
    if (g_liftTime > 0.0 && g_dist >= g_liftWavePos - 1.5 && g_dist <= g_liftWavePos + 0.5) {
        let distToLift = abs(g_dist - g_liftWavePos);
        let liftIntensity = smoothstep(1.5, 0.0, distToLift);
        (*color) = vec4f((*color).rgb + uniform.uWaveTint * liftIntensity, (*color).a);
    }
    // Dot wave tint (active in dot phase, but not where lift wave is active)
    else if (g_dist <= g_dotWavePos && (g_liftTime <= 0.0 || g_dist > g_liftWavePos + 0.5)) {
        let distToDot = abs(g_dist - g_dotWavePos);
        let dotIntensity = smoothstep(1.0, 0.0, distToDot);
        (*color) = vec4f((*color).rgb + uniform.uDotTint * dotIntensity, (*color).a);
    }
}
`;

/**
 * Radial reveal effect for gaussian splats.
 * Creates two waves emanating from a center point:
 * 1. Dot wave: Small colored dots appear progressively
 * 2. Lift wave: Particles lift up, get highlighted, then settle to original state
 *
 * @example
 * // Add the script to a gsplat entity
 * entity.addComponent('script');
 * entity.script.create(GsplatRevealRadial, {
 *     attributes: {
 *         center: new pc.Vec3(0, 0, 0),
 *         speed: 2,
 *         delay: 1,
 *         oscillationIntensity: 0.2
 *     }
 * });
 */
class GsplatRevealRadial extends GsplatRevealBase {
    static scriptName = 'gsplatRevealRadial';

    // Reusable arrays for uniform updates
    _centerArray = [0, 0, 0];

    _dotTintArray = [0, 0, 0];

    _waveTintArray = [0, 0, 0];

    /**
     * Origin point for radial waves
     * @attribute
     */
    center = new Vec3(0, 0, 0);

    /**
     * Base wave speed in units/second
     * @attribute
     * @range [0, 10]
     */
    speed = 1;

    /**
     * Speed increase over time
     * @attribute
     * @range [0, 5]
     */
    acceleration = 5;

    /**
     * Time offset before lift wave starts (seconds)
     * @attribute
     * @range [0, 10]
     */
    delay = 2;

    /**
     * Additive color for initial dots
     * @attribute
     */
    dotTint = new Color(0, 1, 1);

    /**
     * Additive color for lift wave highlight
     * @attribute
     */
    waveTint = new Color(5, 0, 0);

    /**
     * Position oscillation strength
     * @attribute
     * @range [0, 1]
     */
    oscillationIntensity = 0.1;

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
            uSpeed: 1,
            uAcceleration: 0,
            uDelay: 2,
            uDotTint: [1, 1, 1],
            uWaveTint: [1, 1, 1],
            uOscillationIntensity: 0.1,
            uEndRadius: 25
        };
    }

    updateUniforms(dt) {
        // Update uniforms from attributes
        const { uniforms } = this;
        if (!uniforms) return;

        this._centerArray[0] = this.center.x;
        this._centerArray[1] = this.center.y;
        this._centerArray[2] = this.center.z;
        uniforms.uCenter.setValue(this._centerArray);

        uniforms.uSpeed.setValue(this.speed);
        uniforms.uAcceleration.setValue(this.acceleration);
        uniforms.uDelay.setValue(this.delay);

        this._dotTintArray[0] = this.dotTint.r;
        this._dotTintArray[1] = this.dotTint.g;
        this._dotTintArray[2] = this.dotTint.b;
        uniforms.uDotTint.setValue(this._dotTintArray);

        this._waveTintArray[0] = this.waveTint.r;
        this._waveTintArray[1] = this.waveTint.g;
        this._waveTintArray[2] = this.waveTint.b;
        uniforms.uWaveTint.setValue(this._waveTintArray);

        uniforms.uOscillationIntensity.setValue(this.oscillationIntensity);
        uniforms.uEndRadius.setValue(this.endRadius);
    }

    /**
     * Calculates when the lift wave reaches endRadius.
     * @returns {number} Time in seconds when the effect completes
     */
    getCompletionTime() {
        const liftStartTime = this.delay;

        // Solve for when wave reaches endRadius
        // endRadius = speed * t + 0.5 * acceleration * t²
        if (this.acceleration === 0) {
            // No acceleration: simple linear motion
            return liftStartTime + (this.endRadius / this.speed);
        }
        // With acceleration: use quadratic formula
        // 0.5 * a * t² + v * t - d = 0
        // t = (-v + sqrt(v² + 2ad)) / a
        const discriminant = this.speed * this.speed + 2 * this.acceleration * this.endRadius;
        if (discriminant < 0) {
            // Should not happen with positive values, but handle gracefully
            return Infinity;
        }
        const t = (-this.speed + Math.sqrt(discriminant)) / this.acceleration;
        return liftStartTime + t;

    }

    /**
     * Checks if the reveal effect has completed (lift wave reached endRadius).
     * @returns {boolean} True if effect is complete
     */
    isEffectComplete() {
        return this.currentTime >= this.getCompletionTime();
    }
}

export { GsplatRevealRadial };
