import { Vec3, Color } from 'playcanvas';
import { GsplatShaderEffect } from './gsplat-shader-effect.mjs';

const shaderGLSL = /* glsl */`
uniform float uProgress;
uniform float uEdgeWidth;
uniform float uNoiseFrequency;
uniform vec3 uEdgeColor;
uniform vec3 uLiftDirection;
uniform float uLiftDistance;
uniform float uWaveAmplitude;
uniform float uWaveFrequency;
uniform float uTime;

// Global state for shader - burn factor: 0 = intact, (0,1) = burning edge, 1 = dissolved
float g_burn;

float dissolveHash(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

float dissolveNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(dissolveHash(i + vec3(0.0, 0.0, 0.0)), dissolveHash(i + vec3(1.0, 0.0, 0.0)), u.x),
            mix(dissolveHash(i + vec3(0.0, 1.0, 0.0)), dissolveHash(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
        mix(mix(dissolveHash(i + vec3(0.0, 0.0, 1.0)), dissolveHash(i + vec3(1.0, 0.0, 1.0)), u.x),
            mix(dissolveHash(i + vec3(0.0, 1.0, 1.0)), dissolveHash(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
        u.z);
}

// 3-octave fractal noise, normalized to ~[0, 1]
float dissolveFbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
        sum += amp * dissolveNoise(p);
        p *= 2.02;
        amp *= 0.5;
    }
    return sum / 0.875;
}

void modifySplatCenter(inout vec3 center) {
    float n = dissolveFbm(center * uNoiseFrequency);
    g_burn = clamp((uProgress * (1.0 + uEdgeWidth) - n) / uEdgeWidth, 0.0, 1.0);

    if (g_burn <= 0.0) {
        return;
    }

    // burning splats fly off as particles - accelerate along lift direction
    float travel = g_burn * g_burn;
    vec3 offset = uLiftDirection * (travel * uLiftDistance);

    // per-splat sine-wave sway, phase varied by noise so particles don't move in lockstep
    float phase = n * 43.7;
    offset.x += sin(center.y * uWaveFrequency + phase + uTime * 2.0) * uWaveAmplitude * travel;
    offset.z += cos(center.x * uWaveFrequency + phase + uTime * 1.7) * uWaveAmplitude * travel;

    center += offset;
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
    if (g_burn <= 0.0) return;

    if (g_burn >= 1.0) {
        // fully dissolved - hide
        scale = vec3(0.0);
        return;
    }

    // shrink particles as they burn away
    scale *= (1.0 - g_burn);
}

void modifySplatColor(vec3 center, inout vec4 color) {
    if (g_burn <= 0.0) return;

    // glow with edge color while burning, fade out near the end
    color.rgb = mix(color.rgb, uEdgeColor, smoothstep(0.0, 0.4, g_burn));
    color.a *= 1.0 - smoothstep(0.5, 1.0, g_burn);
}
`;

const shaderWGSL = /* wgsl */`
uniform uProgress: f32;
uniform uEdgeWidth: f32;
uniform uNoiseFrequency: f32;
uniform uEdgeColor: vec3f;
uniform uLiftDirection: vec3f;
uniform uLiftDistance: f32;
uniform uWaveAmplitude: f32;
uniform uWaveFrequency: f32;
uniform uTime: f32;

// Global state for shader - burn factor: 0 = intact, (0,1) = burning edge, 1 = dissolved
var<private> g_burn: f32;

fn dissolveHash(pIn: vec3f) -> f32 {
    var p = fract(pIn * vec3f(443.8975, 397.2973, 491.1871));
    p = p + vec3f(dot(p, p.yzx + vec3f(19.19)));
    return fract((p.x + p.y) * p.z);
}

fn dissolveNoise(p: vec3f) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (vec3f(3.0) - 2.0 * f);
    return mix(
        mix(mix(dissolveHash(i + vec3f(0.0, 0.0, 0.0)), dissolveHash(i + vec3f(1.0, 0.0, 0.0)), u.x),
            mix(dissolveHash(i + vec3f(0.0, 1.0, 0.0)), dissolveHash(i + vec3f(1.0, 1.0, 0.0)), u.x), u.y),
        mix(mix(dissolveHash(i + vec3f(0.0, 0.0, 1.0)), dissolveHash(i + vec3f(1.0, 0.0, 1.0)), u.x),
            mix(dissolveHash(i + vec3f(0.0, 1.0, 1.0)), dissolveHash(i + vec3f(1.0, 1.0, 1.0)), u.x), u.y),
        u.z);
}

// 3-octave fractal noise, normalized to ~[0, 1]
fn dissolveFbm(pIn: vec3f) -> f32 {
    var p = pIn;
    var sum = 0.0;
    var amp = 0.5;
    for (var i = 0; i < 3; i++) {
        sum = sum + amp * dissolveNoise(p);
        p = p * 2.02;
        amp = amp * 0.5;
    }
    return sum / 0.875;
}

fn modifySplatCenter(center: ptr<function, vec3f>) {
    let n = dissolveFbm((*center) * uniform.uNoiseFrequency);
    g_burn = clamp((uniform.uProgress * (1.0 + uniform.uEdgeWidth) - n) / uniform.uEdgeWidth, 0.0, 1.0);

    if (g_burn <= 0.0) {
        return;
    }

    // burning splats fly off as particles - accelerate along lift direction
    let travel = g_burn * g_burn;
    var offset = uniform.uLiftDirection * (travel * uniform.uLiftDistance);

    // per-splat sine-wave sway, phase varied by noise so particles don't move in lockstep
    let phase = n * 43.7;
    offset.x = offset.x + sin((*center).y * uniform.uWaveFrequency + phase + uniform.uTime * 2.0) * uniform.uWaveAmplitude * travel;
    offset.z = offset.z + cos((*center).x * uniform.uWaveFrequency + phase + uniform.uTime * 1.7) * uniform.uWaveAmplitude * travel;

    *center = (*center) + offset;
}

fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
    if (g_burn <= 0.0) { return; }

    if (g_burn >= 1.0) {
        // fully dissolved - hide
        *scale = vec3f(0.0);
        return;
    }

    // shrink particles as they burn away
    *scale = (*scale) * (1.0 - g_burn);
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
    if (g_burn <= 0.0) { return; }

    // glow with edge color while burning, fade out near the end
    let rgb = mix((*color).rgb, uniform.uEdgeColor, smoothstep(0.0, 0.4, g_burn));
    let alpha = (*color).a * (1.0 - smoothstep(0.5, 1.0, g_burn));
    *color = vec4f(rgb, alpha);
}
`;

/**
 * Dissolve shader effect for gaussian splats.
 *
 * Drives a noise threshold through the splats: splats below the threshold are hidden, while
 * splats within the edge band glow with an HDR edge color and fly off along a lift direction
 * with a sine-wave sway, shrinking and fading as they go - each splat acts as a particle of
 * the dissolve. Running the effect with {@link dissolve} set to false reverses the animation,
 * reassembling the splats instead.
 *
 * @example
 * // Add the script to a gsplat entity
 * entity.addComponent('script');
 * const dissolveScript = entity.script.create(GsplatDissolveShaderEffect);
 * dissolveScript.duration = 2.5;
 * dissolveScript.edgeColor.set(6, 1.5, 0.2);
 */
class GsplatDissolveShaderEffect extends GsplatShaderEffect {
    static scriptName = 'gsplatDissolveShaderEffect';

    // Reusable arrays for uniform updates
    _edgeColorArray = [0, 0, 0];

    _liftDirectionArray = [0, 0, 0];

    // Reusable Vec3 for lift direction normalization
    _liftDir = new Vec3();

    /**
     * Duration of the dissolve animation in seconds
     * @attribute
     */
    duration = 2.5;

    /**
     * Direction of the effect - true dissolves the splats away, false reassembles them
     * @attribute
     */
    dissolve = true;

    /**
     * Spatial frequency of the dissolve noise - higher values create smaller, more detailed
     * dissolve islands
     * @attribute
     */
    noiseFrequency = 2.2;

    /**
     * Width of the burning edge band, as a fraction of the noise range
     * @attribute
     */
    edgeWidth = 0.12;

    /**
     * Color of the burning edge glow (values above 1 give an HDR glow with bloom)
     * @attribute
     */
    edgeColor = new Color(6, 1.5, 0.2);

    /**
     * Direction burning splats fly off in
     * @attribute
     */
    liftDirection = new Vec3(0, 1, 0);

    /**
     * Distance burning splats travel along the lift direction before disappearing
     * @attribute
     */
    liftDistance = 0.6;

    /**
     * Amplitude of the sine-wave sway applied to burning splats
     * @attribute
     */
    waveAmplitude = 0.06;

    /**
     * Spatial frequency of the sine-wave sway
     * @attribute
     */
    waveFrequency = 6;

    getShaderGLSL() {
        return shaderGLSL;
    }

    getShaderWGSL() {
        return shaderWGSL;
    }

    updateEffect(effectTime, dt) {
        let progress = Math.max(0, Math.min(1, effectTime / Math.max(this.duration, 0.001)));
        if (!this.dissolve) {
            progress = 1 - progress;
        }
        this.setUniform('uProgress', progress);
        this.setUniform('uEdgeWidth', Math.max(this.edgeWidth, 0.001));
        this.setUniform('uNoiseFrequency', this.noiseFrequency);
        this.setUniform('uTime', effectTime);

        this._edgeColorArray[0] = this.edgeColor.r;
        this._edgeColorArray[1] = this.edgeColor.g;
        this._edgeColorArray[2] = this.edgeColor.b;
        this.setUniform('uEdgeColor', this._edgeColorArray);

        // Pass normalized lift direction (zero vector if degenerate)
        this._liftDir.copy(this.liftDirection);
        if (this._liftDir.lengthSq() > 0.000001) {
            this._liftDir.normalize();
        } else {
            this._liftDir.set(0, 0, 0);
        }
        this._liftDirectionArray[0] = this._liftDir.x;
        this._liftDirectionArray[1] = this._liftDir.y;
        this._liftDirectionArray[2] = this._liftDir.z;
        this.setUniform('uLiftDirection', this._liftDirectionArray);

        this.setUniform('uLiftDistance', this.liftDistance);
        this.setUniform('uWaveAmplitude', this.waveAmplitude);
        this.setUniform('uWaveFrequency', this.waveFrequency);
    }
}

export { GsplatDissolveShaderEffect };
