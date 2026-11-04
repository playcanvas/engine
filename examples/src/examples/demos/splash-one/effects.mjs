// Smoke, fire and trails for the Splash One demo.
//
// Everything that burns or smokes - missile trails, fireballs, burning wrecks, debris, flares - is a
// particle in one shared pool, drawn with a single instanced draw call. The particles are simulated on
// the CPU and sorted back to front every frame, which is what lets dense white missile smoke and black
// smoke from a burning plane overlap correctly however the camera looks through them.
//
// The smoke is lit rather than painted: each puff in the generated texture atlas carries a normal as
// well as a density, so it is shaded by the sun like a lump of cloud, picks up the color of the sky, and
// glows around its thin edges when it is between the camera and the sun. Fire is the same particle
// running hot - an emissive heat value that cools over its life, so a fireball rolls over into the smoke
// it leaves behind. Premultiplied alpha lets a particle be anything from an additive glow to opaque
// smoke, so both live in the one sorted draw. Particles fade where they meet the ground (soft particles,
// using the scene depth map) and as the camera flies through them.
//
// The thin vapor trails from the wingtips and the engines are ribbons rather than particles - a camera
// facing strip through the recent positions of each emitter - which stays continuous however fast the
// plane is moving. The wakes of the ships are strips too, laid flat on the water behind them.

import {
    BLEND_ADDITIVE,
    BLEND_NORMAL,
    BLEND_PREMULTIPLIED,
    BUFFER_DYNAMIC,
    BUFFER_STATIC,
    CULLFACE_NONE,
    Color,
    Entity,
    FILTER_LINEAR,
    FILTER_LINEAR_MIPMAP_LINEAR,
    INDEXFORMAT_UINT32,
    IndexBuffer,
    LIGHTFALLOFF_INVERSESQUARED,
    Mesh,
    MeshInstance,
    PIXELFORMAT_RGBA8,
    PRIMITIVE_TRIANGLES,
    SEMANTIC_ATTR10,
    SEMANTIC_ATTR11,
    SEMANTIC_ATTR12,
    SEMANTIC_ATTR13,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    ShaderMaterial,
    TYPE_FLOAT32,
    Texture,
    Vec3,
    VertexBuffer,
    VertexFormat,
    math
} from 'playcanvas';

import { atmosphereChunks } from './atmosphere.mjs';

/**
 * @import { AppBase, CameraComponent, GraphicsDevice, Layer } from 'playcanvas'
 */

// --------------------------------------------------------------------------------------------
// shaders

// the atlas is 4 x 2 cells - six smoke puffs, a ragged flame and a chunk of debris. Frames from 8 up
// are drawn analytically as a round glow instead, for sparks, flares and flashes
const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 2;
const FRAME_GLOW = 8;

const particleVertexGLSL = /* glsl */ `
    attribute vec3 vertex_position;
    attribute vec4 aPosSize;
    attribute vec4 aColor;
    attribute vec4 aParams;
    attribute vec4 aStretch;

    uniform mat4 matrix_viewProjection;
    uniform mat4 matrix_view;
    uniform vec3 view_position;

    varying vec4 vColor;
    varying vec4 vParams;
    varying vec2 vUv;
    varying vec2 vQuad;
    varying vec3 vWorldPos;
    varying vec3 vRight;
    varying vec3 vUp;
    varying float vDepth;
    varying float vSize;

    void main(void) {
        vec3 camRight = vec3(matrix_view[0][0], matrix_view[1][0], matrix_view[2][0]);
        vec3 camUp = vec3(matrix_view[0][1], matrix_view[1][1], matrix_view[2][1]);
        vec3 center = aPosSize.xyz;
        float size = aPosSize.w;
        vec2 corner = vertex_position.xy;

        vec3 right;
        vec3 up;
        vec3 offset;
        float stretch = length(aStretch.xyz);
        if (stretch > 0.001) {
            // a streak, laid along the direction it moves in as seen on screen, trailing behind it
            vec3 toCamera = normalize(view_position - center);
            vec3 axis = aStretch.xyz - toCamera * dot(aStretch.xyz, toCamera);
            float axisLength = length(axis);
            up = axisLength > 0.0001 ? axis / axisLength : camUp;
            right = normalize(cross(up, toCamera));
            center += up * axisLength * 0.5;
            offset = right * corner.x * size + up * corner.y * (size + axisLength * 0.5);
        } else {
            float s = sin(aParams.x);
            float c = cos(aParams.x);
            right = camRight * c + camUp * s;
            up = camUp * c - camRight * s;
            offset = (right * corner.x + up * corner.y) * size;
        }

        vec3 worldPos = center + offset;
        gl_Position = matrix_viewProjection * vec4(worldPos, 1.0);

        float frame = aParams.y;
        vec2 cell = vec2(mod(frame, ${ATLAS_COLUMNS}.0), floor(frame / ${ATLAS_COLUMNS}.0));
        vUv = (cell + corner * 0.5 + 0.5) / vec2(${ATLAS_COLUMNS}.0, ${ATLAS_ROWS}.0);
        vQuad = corner;
        vColor = aColor;
        vParams = vec4(aParams.z, aParams.w, aStretch.w, frame);
        vWorldPos = worldPos;
        vRight = right;
        vUp = up;
        vDepth = -(matrix_view * vec4(worldPos, 1.0)).z;
        vSize = size;
    }
`;

const particleFragmentGLSL = /* glsl */ `
    #include "gammaPS"
    #include "screenDepthPS"

    ${atmosphereChunks.glsl}

    uniform vec3 view_position;
    uniform sampler2D uAtlas;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec3 uGroundColor;
    uniform float uEmissiveScale;

    varying vec4 vColor;
    varying vec4 vParams;
    varying vec2 vUv;
    varying vec2 vQuad;
    varying vec3 vWorldPos;
    varying vec3 vRight;
    varying vec3 vUp;
    varying float vDepth;
    varying float vSize;

    // the color of something burning at a given heat, from a dull red ember up to white hot
    vec3 fireColor(float heat) {
        vec3 color = mix(vec3(0.5, 0.04, 0.0), vec3(1.0, 0.28, 0.02), smoothstep(0.0, 0.35, heat));
        color = mix(color, vec3(1.0, 0.58, 0.16), smoothstep(0.35, 0.75, heat));
        return mix(color, vec3(1.0, 0.82, 0.5), smoothstep(0.75, 1.0, heat));
    }

    void main(void) {
        float density;
        vec2 bend;
        float detail;
        if (vParams.w >= ${FRAME_GLOW}.0) {
            // a round glow, with a hot core
            float r2 = dot(vQuad, vQuad);
            density = exp(-r2 * 4.0) * (1.0 - smoothstep(0.7, 1.0, r2));
            bend = vQuad * 0.6;
            detail = 1.0;
        } else {
            vec4 texel = texture2D(uAtlas, vUv);
            density = texel.r;
            bend = texel.gb * 2.0 - 1.0;
            detail = texel.a;
        }

        float alpha = density * vColor.a;

        // soft where the particle cuts into the ground or a wreck, and faded out as the camera
        // flies into it, which would otherwise fill the screen with one flat puff
        float sceneDepth = getLinearScreenDepth();
        alpha *= clamp((sceneDepth - vDepth) / max(vSize * 0.6, 0.5), 0.0, 1.0);
        alpha *= clamp((vDepth - 1.5) / max(vSize * 1.5, 1.0), 0.0, 1.0);

        if (alpha < 0.002) {
            discard;
        }

        // the puff's surface normal, from the bend stored in the atlas
        vec3 toCamera = normalize(view_position - vWorldPos);
        vec3 normal = normalize(vRight * bend.x + vUp * bend.y + toCamera * sqrt(max(1.0 - dot(bend, bend), 0.05)));

        // wrapped diffuse, so the shaded side of a cloud of smoke is soft rather than black
        float sun = clamp(dot(normal, uSunDir) * 0.55 + 0.45, 0.0, 1.0);

        // the sun shining through the thin edges of smoke between the camera and the sun
        float through = pow(clamp(dot(-toCamera, uSunDir), 0.0, 1.0), 6.0) * (1.0 - density) * 2.5;

        vec3 ambient = mix(uGroundColor, uSkyColor, normal.y * 0.5 + 0.5);
        vec3 lit = vColor.rgb * (ambient + uSunColor * (sun + through));

        // fire - hottest in the dense middle of the puff, flickering with the detail noise. A glow
        // with an albedo of its own is a colored light, which takes that color instead
        float heat = clamp(vParams.x * (density * 1.5 - 0.15) * (0.75 + detail * 0.5), 0.0, 1.0);
        vec3 tint = vParams.w >= ${FRAME_GLOW}.0 && dot(vColor.rgb, vec3(1.0)) > 0.0 ? vColor.rgb * 2.0 : fireColor(heat);
        vec3 fire = tint * heat * vParams.y * uEmissiveScale;

        vec3 color = (lit * (1.0 - min(vParams.x, 1.0)) + fire) * alpha;

        // an additive particle leaves the destination as it is, a blended one covers it
        float coverage = alpha * (1.0 - vParams.z);

        color = atmosphereApply(color, view_position, vWorldPos, coverage);
        gl_FragColor = vec4(gammaCorrectOutput(color), coverage);
    }
`;

const particleVertexWGSL = /* wgsl */ `
    attribute vertex_position: vec3f;
    attribute aPosSize: vec4f;
    attribute aColor: vec4f;
    attribute aParams: vec4f;
    attribute aStretch: vec4f;

    uniform matrix_viewProjection: mat4x4f;
    uniform matrix_view: mat4x4f;
    uniform view_position: vec3f;

    varying vColor: vec4f;
    varying vParams: vec4f;
    varying vUv: vec2f;
    varying vQuad: vec2f;
    varying vWorldPos: vec3f;
    varying vRight: vec3f;
    varying vUp: vec3f;
    varying vDepth: f32;
    varying vSize: f32;

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;

        let view = uniform.matrix_view;
        let camRight = vec3f(view[0][0], view[1][0], view[2][0]);
        let camUp = vec3f(view[0][1], view[1][1], view[2][1]);
        var center = input.aPosSize.xyz;
        let size = input.aPosSize.w;
        let corner = input.vertex_position.xy;

        var right: vec3f;
        var up: vec3f;
        var offset: vec3f;
        let stretch = length(input.aStretch.xyz);
        if (stretch > 0.001) {
            // a streak, laid along the direction it moves in as seen on screen, trailing behind it
            let toCamera = normalize(uniform.view_position - center);
            let axis = input.aStretch.xyz - toCamera * dot(input.aStretch.xyz, toCamera);
            let axisLength = length(axis);
            up = camUp;
            if (axisLength > 0.0001) {
                up = axis / axisLength;
            }
            right = normalize(cross(up, toCamera));
            center = center + up * axisLength * 0.5;
            offset = right * corner.x * size + up * corner.y * (size + axisLength * 0.5);
        } else {
            let s = sin(input.aParams.x);
            let c = cos(input.aParams.x);
            right = camRight * c + camUp * s;
            up = camUp * c - camRight * s;
            offset = (right * corner.x + up * corner.y) * size;
        }

        let worldPos = center + offset;
        output.position = uniform.matrix_viewProjection * vec4f(worldPos, 1.0);

        let frame = input.aParams.y;
        let cell = vec2f(frame - floor(frame / ${ATLAS_COLUMNS}.0) * ${ATLAS_COLUMNS}.0, floor(frame / ${ATLAS_COLUMNS}.0));
        output.vUv = (cell + corner * 0.5 + 0.5) / vec2f(${ATLAS_COLUMNS}.0, ${ATLAS_ROWS}.0);
        output.vQuad = corner;
        output.vColor = input.aColor;
        output.vParams = vec4f(input.aParams.z, input.aParams.w, input.aStretch.w, frame);
        output.vWorldPos = worldPos;
        output.vRight = right;
        output.vUp = up;
        output.vDepth = -(view * vec4f(worldPos, 1.0)).z;
        output.vSize = size;
        return output;
    }
`;

const particleFragmentWGSL = /* wgsl */ `
    #include "gammaPS"
    #include "screenDepthPS"

    ${atmosphereChunks.wgsl}

    uniform view_position: vec3f;
    var uAtlas: texture_2d<f32>;
    var uAtlasSampler: sampler;
    uniform uSunDir: vec3f;
    uniform uSunColor: vec3f;
    uniform uSkyColor: vec3f;
    uniform uGroundColor: vec3f;
    uniform uEmissiveScale: f32;

    varying vColor: vec4f;
    varying vParams: vec4f;
    varying vUv: vec2f;
    varying vQuad: vec2f;
    varying vWorldPos: vec3f;
    varying vRight: vec3f;
    varying vUp: vec3f;
    varying vDepth: f32;
    varying vSize: f32;

    // the color of something burning at a given heat, from a dull red ember up to white hot
    fn fireColor(heat: f32) -> vec3f {
        var color = mix(vec3f(0.5, 0.04, 0.0), vec3f(1.0, 0.28, 0.02), vec3f(smoothstep(0.0, 0.35, heat)));
        color = mix(color, vec3f(1.0, 0.58, 0.16), vec3f(smoothstep(0.35, 0.75, heat)));
        return mix(color, vec3f(1.0, 0.82, 0.5), vec3f(smoothstep(0.75, 1.0, heat)));
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        // sampled unconditionally, as texture sampling needs uniform control flow
        let texel = textureSample(uAtlas, uAtlasSampler, input.vUv);

        var density = texel.r;
        var bend = texel.gb * 2.0 - 1.0;
        var detail = texel.a;
        if (input.vParams.w >= ${FRAME_GLOW}.0) {
            // a round glow, with a hot core
            let r2 = dot(input.vQuad, input.vQuad);
            density = exp(-r2 * 4.0) * (1.0 - smoothstep(0.7, 1.0, r2));
            bend = input.vQuad * 0.6;
            detail = 1.0;
        }

        var alpha = density * input.vColor.a;

        // soft where the particle cuts into the ground or a wreck, and faded out as the camera
        // flies into it, which would otherwise fill the screen with one flat puff
        let sceneDepth = getLinearScreenDepthFrag();
        alpha = alpha * clamp((sceneDepth - input.vDepth) / max(input.vSize * 0.6, 0.5), 0.0, 1.0);
        alpha = alpha * clamp((input.vDepth - 1.5) / max(input.vSize * 1.5, 1.0), 0.0, 1.0);

        if (alpha < 0.002) {
            discard;
            return output;
        }

        // the puff's surface normal, from the bend stored in the atlas
        let toCamera = normalize(uniform.view_position - input.vWorldPos);
        let normal = normalize(input.vRight * bend.x + input.vUp * bend.y + toCamera * sqrt(max(1.0 - dot(bend, bend), 0.05)));

        // wrapped diffuse, so the shaded side of a cloud of smoke is soft rather than black
        let sun = clamp(dot(normal, uniform.uSunDir) * 0.55 + 0.45, 0.0, 1.0);

        // the sun shining through the thin edges of smoke between the camera and the sun
        let through = pow(clamp(dot(-toCamera, uniform.uSunDir), 0.0, 1.0), 6.0) * (1.0 - density) * 2.5;

        let ambient = mix(uniform.uGroundColor, uniform.uSkyColor, vec3f(normal.y * 0.5 + 0.5));
        let lit = input.vColor.rgb * (ambient + uniform.uSunColor * (sun + through));

        // fire - hottest in the dense middle of the puff, flickering with the detail noise. A glow
        // with an albedo of its own is a colored light, which takes that color instead
        let heat = clamp(input.vParams.x * (density * 1.5 - 0.15) * (0.75 + detail * 0.5), 0.0, 1.0);
        var tint = fireColor(heat);
        if (input.vParams.w >= ${FRAME_GLOW}.0 && dot(input.vColor.rgb, vec3f(1.0)) > 0.0) {
            tint = input.vColor.rgb * 2.0;
        }
        let fire = tint * heat * input.vParams.y * uniform.uEmissiveScale;

        var color = (lit * (1.0 - min(input.vParams.x, 1.0)) + fire) * alpha;

        // an additive particle leaves the destination as it is, a blended one covers it
        let coverage = alpha * (1.0 - input.vParams.z);

        color = atmosphereApply(color, uniform.view_position, input.vWorldPos, coverage);
        output.color = vec4f(gammaCorrectOutput(color), coverage);
        return output;
    }
`;

// The vapor trails - a strip whose edges fade out, aging from bright and tight to faint and wide. A
// trail kept a few pixels wide in the distance has its edges flattened out the thinner it really is,
// as soft edges that narrow would flicker as the trail crosses the rows of pixels.
const ribbonVertexGLSL = /* glsl */ `
    attribute vec3 vertex_position;
    attribute vec4 aData;

    uniform mat4 matrix_viewProjection;

    varying vec4 vData;
    varying vec3 vWorldPos;

    void main(void) {
        gl_Position = matrix_viewProjection * vec4(vertex_position, 1.0);
        vData = aData;
        vWorldPos = vertex_position;
    }
`;

const ribbonFragmentGLSL = /* glsl */ `
    #include "gammaPS"

    ${atmosphereChunks.glsl}

    uniform vec3 view_position;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;

    varying vec4 vData;
    varying vec3 vWorldPos;

    void main(void) {
        float edge = 1.0 - vData.y * vData.y;
        float alpha = vData.x * mix(edge * edge, 0.8, vData.w);
        vec3 color = (uSkyColor * 1.1 + uSunColor * 0.75) * alpha;
        color = atmosphereApply(color, view_position, vWorldPos, alpha);
        gl_FragColor = vec4(gammaCorrectOutput(color), alpha);
    }
`;

const ribbonVertexWGSL = /* wgsl */ `
    attribute vertex_position: vec3f;
    attribute aData: vec4f;

    uniform matrix_viewProjection: mat4x4f;

    varying vData: vec4f;
    varying vWorldPos: vec3f;

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = uniform.matrix_viewProjection * vec4f(input.vertex_position, 1.0);
        output.vData = input.aData;
        output.vWorldPos = input.vertex_position;
        return output;
    }
`;

const ribbonFragmentWGSL = /* wgsl */ `
    #include "gammaPS"

    ${atmosphereChunks.wgsl}

    uniform view_position: vec3f;
    uniform uSunColor: vec3f;
    uniform uSkyColor: vec3f;

    varying vData: vec4f;
    varying vWorldPos: vec3f;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let edge = 1.0 - input.vData.y * input.vData.y;
        let alpha = input.vData.x * mix(edge * edge, 0.8, input.vData.w);
        var color = (uniform.uSkyColor * 1.1 + uniform.uSunColor * 0.75) * alpha;
        color = atmosphereApply(color, uniform.view_position, input.vWorldPos, alpha);
        output.color = vec4f(gammaCorrectOutput(color), alpha);
        return output;
    }
`;

// The afterburner - a cone of glowing gas, white hot at the nozzle, cooling through orange, with the
// bright bands of the shock diamonds standing in it. Additive, so it is only ever light.
const flameVertexGLSL = /* glsl */ `
    attribute vec3 vertex_position;
    attribute vec2 vertex_texCoord0;

    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;
    uniform vec4 uFlame;

    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vAxis;

    void main(void) {
        // stretched along its length by the throttle, and thickened a little with it
        vec3 local = vertex_position;
        local.z *= uFlame.x;
        local.xy *= 0.85 + uFlame.x * 0.15;
        vec4 world = matrix_model * vec4(local, 1.0);
        gl_Position = matrix_viewProjection * world;
        vUv = vertex_texCoord0;
        vWorldPos = world.xyz;
        vAxis = normalize(mat3(matrix_model) * vec3(0.0, 0.0, 1.0));
    }
`;

const flameFragmentGLSL = /* glsl */ `
    #include "gammaPS"

    uniform vec3 view_position;
    uniform vec4 uFlame;

    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vAxis;

    void main(void) {
        float along = vUv.y;
        float around = vUv.x;

        // brightest down the middle of the cone, seen side on or end on
        vec3 toCamera = normalize(view_position - vWorldPos);
        float endOn = abs(dot(toCamera, vAxis));

        // kept off zero - the interpolated end of the cone can overshoot 1, and a power of a
        // negative number is NaN, which comes out as a black dot at the tip
        float body = pow(max(1.0 - along, 0.0), 2.4);
        float diamonds = 0.65 + 0.35 * cos(along * 34.0 - uFlame.y * 3.0) * (1.0 - along);
        float flicker = 0.85 + 0.15 * sin(uFlame.y * 41.0 + around * 6.283 * 3.0 + along * 9.0);

        vec3 core = vec3(0.75, 0.85, 1.0);
        vec3 outer = vec3(1.0, 0.42, 0.12);
        vec3 color = mix(core, outer, smoothstep(0.05, 0.6, along));

        float intensity = body * diamonds * flicker * uFlame.z * (0.55 + endOn * 0.6);
        gl_FragColor = vec4(gammaCorrectOutput(color * intensity), 1.0);
    }
`;

const flameVertexWGSL = /* wgsl */ `
    attribute vertex_position: vec3f;
    attribute vertex_texCoord0: vec2f;

    uniform matrix_model: mat4x4f;
    uniform matrix_viewProjection: mat4x4f;
    uniform uFlame: vec4f;

    varying vUv: vec2f;
    varying vWorldPos: vec3f;
    varying vAxis: vec3f;

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;

        // stretched along its length by the throttle, and thickened a little with it
        var local = input.vertex_position;
        local.z = local.z * uniform.uFlame.x;
        local = vec3f(local.xy * (0.85 + uniform.uFlame.x * 0.15), local.z);
        let world = uniform.matrix_model * vec4f(local, 1.0);
        output.position = uniform.matrix_viewProjection * world;
        output.vUv = input.vertex_texCoord0;
        output.vWorldPos = world.xyz;
        output.vAxis = normalize((uniform.matrix_model * vec4f(0.0, 0.0, 1.0, 0.0)).xyz);
        return output;
    }
`;

const flameFragmentWGSL = /* wgsl */ `
    #include "gammaPS"

    uniform view_position: vec3f;
    uniform uFlame: vec4f;

    varying vUv: vec2f;
    varying vWorldPos: vec3f;
    varying vAxis: vec3f;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let along = input.vUv.y;
        let around = input.vUv.x;

        // brightest down the middle of the cone, seen side on or end on
        let toCamera = normalize(uniform.view_position - input.vWorldPos);
        let endOn = abs(dot(toCamera, input.vAxis));

        let body = pow(max(1.0 - along, 0.0), 2.4);
        let diamonds = 0.65 + 0.35 * cos(along * 34.0 - uniform.uFlame.y * 3.0) * (1.0 - along);
        let flicker = 0.85 + 0.15 * sin(uniform.uFlame.y * 41.0 + around * 6.283 * 3.0 + along * 9.0);

        let core = vec3f(0.75, 0.85, 1.0);
        let outer = vec3f(1.0, 0.42, 0.12);
        let color = mix(core, outer, vec3f(smoothstep(0.05, 0.6, along)));

        let intensity = body * diamonds * flicker * uniform.uFlame.z * (0.55 + endOn * 0.6);
        output.color = vec4f(gammaCorrectOutput(color * intensity), 1.0);
        return output;
    }
`;

// --------------------------------------------------------------------------------------------
// the texture atlas

/**
 * A small seeded random number generator, so the atlas comes out the same every time.
 *
 * @param {number} seed - The seed.
 * @returns {() => number} A function returning values between zero and one.
 */
const createRandom = (seed) => {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * Tileable value noise on a small lattice, used to break up the generated shapes.
 *
 * @param {number} size - The lattice size.
 * @param {() => number} random - The random number generator.
 * @returns {(x: number, y: number) => number} Noise between zero and one, wrapping every `size` units.
 */
const createLatticeNoise = (size, random) => {
    const lattice = new Float32Array(size * size);
    for (let i = 0; i < lattice.length; i++) {
        lattice[i] = random();
    }
    return (x, y) => {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const xf = x - xi;
        const yf = y - yi;
        const u = xf * xf * (3 - 2 * xf);
        const v = yf * yf * (3 - 2 * yf);
        const x0 = ((xi % size) + size) % size;
        const y0 = ((yi % size) + size) % size;
        const x1 = (x0 + 1) % size;
        const y1 = (y0 + 1) % size;
        const a = lattice[y0 * size + x0];
        const b = lattice[y0 * size + x1];
        const c = lattice[y1 * size + x0];
        const d = lattice[y1 * size + x1];
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    };
};

/**
 * Generates the particle atlas. Red is the density, green and blue the bend of the surface used to
 * light it, and alpha a fine noise which makes fire flicker within each puff.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @returns {Texture} The atlas texture.
 */
const createAtlas = (device) => {
    const cell = 128;
    const width = cell * ATLAS_COLUMNS;
    const height = cell * ATLAS_ROWS;
    const pixels = new Uint8Array(width * height * 4);
    const random = createRandom(1234);
    const noise = createLatticeNoise(64, random);

    const density = new Float32Array(cell * cell);
    const shape = new Float32Array(cell * cell);

    const fbm = (x, y, octaves) => {
        let sum = 0;
        let amplitude = 0.5;
        let frequency = 1;
        let norm = 0;
        for (let o = 0; o < octaves; o++) {
            sum += noise(x * frequency, y * frequency) * amplitude;
            norm += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }
        return sum / norm;
    };

    for (let frame = 0; frame < ATLAS_COLUMNS * ATLAS_ROWS; frame++) {
        const isFlame = frame === 6;
        const isDebris = frame === 7;

        // a puff is a cluster of soft blobs - a few large ones in the middle, smaller ones around
        // them - so its outline is lumpy rather than a circle
        const blobs = [];
        const blobCount = isFlame ? 4 : 7;
        for (let b = 0; b < blobCount; b++) {
            const angle = random() * Math.PI * 2;
            const distance = b === 0 ? 0 : 0.18 + random() * 0.3;
            blobs.push({
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance * (isFlame ? 1.6 : 1),
                r: b === 0 ? 0.42 : 0.16 + random() * 0.18
            });
        }

        // a jagged polygon for the chunk of debris
        const corners = [];
        const cornerCount = 7;
        for (let c = 0; c < cornerCount; c++) {
            corners.push(0.45 + random() * 0.45);
        }

        const offsetX = random() * 64;
        const offsetY = random() * 64;

        for (let y = 0; y < cell; y++) {
            for (let x = 0; x < cell; x++) {
                const u = ((x + 0.5) / cell) * 2 - 1;
                const v = ((y + 0.5) / cell) * 2 - 1;
                const r = Math.hypot(u, v);
                const index = y * cell + x;

                if (isDebris) {
                    const angle = (Math.atan2(v, u) / (Math.PI * 2) + 1) % 1;
                    const at = angle * cornerCount;
                    const i0 = Math.floor(at) % cornerCount;
                    const i1 = (i0 + 1) % cornerCount;
                    const limit = math.lerp(corners[i0], corners[i1], at - Math.floor(at)) * 0.9;
                    const inside = math.clamp((limit - r) * 30, 0, 1);
                    density[index] = inside;
                    shape[index] = inside * (1 - r / limit) * 1.2;
                    continue;
                }

                let sum = 0;
                for (let b = 0; b < blobs.length; b++) {
                    const blob = blobs[b];
                    const d = Math.hypot(u - blob.x, v - blob.y) / blob.r;
                    sum += Math.exp(-d * d * 1.6);
                }

                // keep everything inside the cell, whatever the blobs did
                const fade = 1 - math.smoothstep(0.55, 0.98, r);
                const n = fbm(u * 3 + offsetX, v * 3 + offsetY, 5);
                const billow = isFlame ? sum * (0.4 + n * 1.2) : sum * (0.55 + n * 0.9);
                const d = math.clamp((billow - 0.25) * 1.4, 0, 1) * fade;
                density[index] = d * d * (3 - 2 * d);
                shape[index] = (sum * 0.7 + n * 0.5) * fade;
            }
        }

        // write the cell, deriving the bend from the slope of the shape
        const originX = (frame % ATLAS_COLUMNS) * cell;
        const originY = Math.floor(frame / ATLAS_COLUMNS) * cell;
        for (let y = 0; y < cell; y++) {
            for (let x = 0; x < cell; x++) {
                const index = y * cell + x;
                const left = shape[y * cell + Math.max(x - 1, 0)];
                const right = shape[y * cell + Math.min(x + 1, cell - 1)];
                const down = shape[Math.max(y - 1, 0) * cell + x];
                const up = shape[Math.min(y + 1, cell - 1) * cell + x];
                const strength = isDebris ? 12 : 9;
                let nx = (left - right) * strength;
                let ny = (down - up) * strength;
                const length = Math.hypot(nx, ny);
                if (length > 0.95) {
                    nx *= 0.95 / length;
                    ny *= 0.95 / length;
                }

                const offset = ((originY + y) * width + originX + x) * 4;
                pixels[offset] = Math.round(density[index] * 255);
                pixels[offset + 1] = Math.round((nx * 0.5 + 0.5) * 255);
                pixels[offset + 2] = Math.round((ny * 0.5 + 0.5) * 255);
                pixels[offset + 3] = Math.round(fbm((x / cell) * 8 + frame * 9, (y / cell) * 8, 3) * 255);
            }
        }
    }

    const texture = new Texture(device, {
        name: 'ParticleAtlas',
        width,
        height,
        format: PIXELFORMAT_RGBA8,
        mipmaps: true,
        minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: FILTER_LINEAR,
        levels: [pixels]
    });
    texture.upload();
    return texture;
};

// --------------------------------------------------------------------------------------------
// the particle pool

/**
 * How a kind of particle looks and moves. Sizes are the half width of the quad, in meters.
 *
 * @typedef {object} ParticlePreset
 * @property {number[]} life - The range of lifetimes, in seconds.
 * @property {number} size0 - The size it is born at.
 * @property {number} size1 - The size it grows to by the end of its life.
 * @property {number} growth - How front loaded the growth is - larger values expand faster early.
 * @property {number[]} color0 - The albedo it is born with.
 * @property {number[]} color1 - The albedo it ends its life with.
 * @property {number} alpha - Its peak opacity.
 * @property {number} fadeIn - The fraction of its life it takes to fade in.
 * @property {number} fadeOut - The exponent of the fade out over its life.
 * @property {number} heat - How hot it is born, from zero for cold smoke to one and above for fire.
 * @property {number} cool - The fraction of its life it takes to cool down completely.
 * @property {number} emissive - How bright its fire is.
 * @property {number} additive - How additive it is, from zero for smoke to one for pure light.
 * @property {number} drag - How quickly it loses its initial speed.
 * @property {number} buoyancy - How quickly it rises, as an acceleration.
 * @property {number} gravity - How quickly it falls, as an acceleration.
 * @property {number} wind - How much the wind carries it.
 * @property {number} spin - The range of spin speeds, in radians per second.
 * @property {number[]} frames - The first and last atlas frame to pick from.
 * @property {number} stretch - How far it streaks along its velocity, in seconds of travel.
 * @property {boolean} collide - Whether it bounces off the ground.
 * @property {number} [index] - Its position in PRESET_LIST, set once all the presets are defined.
 */

/** @type {Record<string, ParticlePreset>} */
export const PRESETS = {
    // the dense white trail of a missile motor
    missileSmoke: {
        life: [3.6, 5],
        size0: 1.05,
        size1: 6,
        growth: 2.6,
        color0: [0.9, 0.9, 0.9],
        color1: [0.72, 0.73, 0.75],
        alpha: 0.6,
        fadeIn: 0.015,
        fadeOut: 1.6,
        heat: 0.35,
        cool: 0.05,
        emissive: 4,
        additive: 0.2,
        drag: 1.2,
        buoyancy: 0.6,
        gravity: 0,
        wind: 1,
        spin: 0.8,
        frames: [0, 5],
        stretch: 0,
        collide: false
    },

    // the white hot plume right behind a motor, which streaks with the missile's speed
    exhaust: {
        life: [0.05, 0.08],
        size0: 0.55,
        size1: 0.2,
        growth: 1,
        color0: [0, 0, 0],
        color1: [0, 0, 0],
        alpha: 1,
        fadeIn: 0,
        fadeOut: 1,
        heat: 1,
        cool: 2,
        emissive: 30,
        additive: 1,
        drag: 0,
        buoyancy: 0,
        gravity: 0,
        wind: 0,
        spin: 0,
        frames: [FRAME_GLOW, FRAME_GLOW],
        stretch: 0,
        collide: false
    },

    // black smoke pouring out of something burning, with fire still in it as it leaves
    burningSmoke: {
        life: [3.2, 4.6],
        size0: 2.4,
        size1: 15,
        growth: 2,
        color0: [0.05, 0.045, 0.04],
        color1: [0.11, 0.105, 0.1],
        alpha: 0.8,
        fadeIn: 0.02,
        fadeOut: 1.3,
        heat: 1.1,
        cool: 0.16,
        emissive: 6,
        additive: 0.25,
        drag: 1.4,
        buoyancy: 2.5,
        gravity: 0,
        wind: 1,
        spin: 0.6,
        frames: [0, 6],
        stretch: 0,
        collide: false
    },

    // the rolling fireball of a detonation, cooling into dark smoke
    fireball: {
        life: [0.9, 1.6],
        size0: 4,
        size1: 14,
        growth: 2.5,
        color0: [0.05, 0.045, 0.04],
        color1: [0.12, 0.11, 0.1],
        alpha: 0.95,
        fadeIn: 0.01,
        fadeOut: 1.4,
        heat: 1.6,
        cool: 0.7,
        emissive: 7,
        additive: 0.5,
        drag: 3,
        buoyancy: 4,
        gravity: 0,
        wind: 0.4,
        spin: 1.2,
        frames: [0, 6],
        stretch: 0,
        collide: false
    },

    // the smoke a detonation leaves hanging in the air
    blastSmoke: {
        life: [4.5, 7],
        size0: 4,
        size1: 18,
        growth: 1.6,
        color0: [0.07, 0.065, 0.06],
        color1: [0.2, 0.19, 0.18],
        alpha: 0.55,
        fadeIn: 0.04,
        fadeOut: 1.5,
        heat: 0.25,
        cool: 0.08,
        emissive: 6,
        additive: 0,
        drag: 2,
        buoyancy: 2.5,
        gravity: 0,
        wind: 1,
        spin: 0.4,
        frames: [0, 5],
        stretch: 0,
        collide: false
    },

    // dust and dirt thrown up by something hitting the ground
    dust: {
        life: [4, 6.5],
        size0: 3,
        size1: 17,
        growth: 1.6,
        color0: [0.3, 0.25, 0.19],
        color1: [0.42, 0.38, 0.32],
        alpha: 0.6,
        fadeIn: 0.03,
        fadeOut: 1.4,
        heat: 0,
        cool: 1,
        emissive: 0,
        additive: 0,
        drag: 2.2,
        buoyancy: 1,
        gravity: 0,
        wind: 1,
        spin: 0.4,
        frames: [0, 5],
        stretch: 0,
        collide: false
    },

    // white water thrown up by a ship's bow, falling back into the sea
    spray: {
        life: [1.2, 2],
        size0: 1.6,
        size1: 6,
        growth: 1.8,
        color0: [0.92, 0.94, 0.95],
        color1: [0.86, 0.89, 0.9],
        alpha: 0.32,
        fadeIn: 0.05,
        fadeOut: 1.3,
        heat: 0,
        cool: 1,
        emissive: 0,
        additive: 0,
        drag: 1.4,
        buoyancy: 0,
        gravity: 5,
        wind: 0.6,
        spin: 0.6,
        frames: [0, 5],
        stretch: 0,
        collide: false
    },

    // the column of smoke that rises off a wreck for a long while after
    wreckSmoke: {
        life: [9, 13],
        size0: 3,
        size1: 30,
        growth: 1.3,
        color0: [0.045, 0.04, 0.038],
        color1: [0.2, 0.19, 0.19],
        alpha: 0.7,
        fadeIn: 0.05,
        fadeOut: 1.4,
        heat: 0.7,
        cool: 0.05,
        emissive: 5,
        additive: 0.2,
        drag: 0.8,
        buoyancy: 5,
        gravity: 0,
        wind: 1.6,
        spin: 0.3,
        frames: [0, 5],
        stretch: 0,
        collide: false
    },

    // white hot sparks flung out of a blast, streaking as they fly and arcing down
    spark: {
        life: [0.6, 1.5],
        size0: 0.28,
        size1: 0.12,
        growth: 1,
        color0: [0, 0, 0],
        color1: [0, 0, 0],
        alpha: 1,
        fadeIn: 0,
        fadeOut: 0.7,
        heat: 1,
        cool: 3,
        emissive: 18,
        additive: 1,
        drag: 0.9,
        buoyancy: 0,
        gravity: 9.8,
        wind: 0,
        spin: 0,
        frames: [FRAME_GLOW, FRAME_GLOW],
        stretch: 0.045,
        collide: true
    },

    // the tracers of the missile defense gun, streaking straight out
    tracer: {
        life: [0.35, 0.45],
        size0: 0.16,
        size1: 0.12,
        growth: 1,
        color0: [1, 0.75, 0.35],
        color1: [1, 0.6, 0.25],
        alpha: 1,
        fadeIn: 0,
        fadeOut: 0.5,
        heat: 1,
        cool: 1e9,
        emissive: 14,
        additive: 1,
        drag: 0,
        buoyancy: 0,
        gravity: 0,
        wind: 0,
        spin: 0,
        frames: [FRAME_GLOW, FRAME_GLOW],
        stretch: 0.02,
        collide: false
    },

    // tumbling chunks of the airframe
    debris: {
        life: [2.5, 4.5],
        size0: 0.7,
        size1: 0.7,
        growth: 1,
        color0: [0.05, 0.05, 0.05],
        color1: [0.03, 0.03, 0.03],
        alpha: 1,
        fadeIn: 0,
        fadeOut: 0.15,
        heat: 0.3,
        cool: 0.2,
        emissive: 4,
        additive: 0,
        drag: 0.25,
        buoyancy: 0,
        gravity: 9.8,
        wind: 0,
        spin: 9,
        frames: [7, 7],
        stretch: 0,
        collide: true
    },

    // the flash of a detonation, gone in a few frames
    flash: {
        life: [0.12, 0.16],
        size0: 10,
        size1: 20,
        growth: 2,
        color0: [1, 0.72, 0.42],
        color1: [1, 0.72, 0.42],
        alpha: 1,
        fadeIn: 0,
        fadeOut: 1.5,
        heat: 1,
        cool: 2,
        emissive: 9,
        additive: 1,
        drag: 0,
        buoyancy: 0,
        gravity: 0,
        wind: 0,
        spin: 0,
        frames: [FRAME_GLOW, FRAME_GLOW],
        stretch: 0,
        collide: false
    },

    // a decoy flare - a blinding magnesium glow
    flare: {
        life: [2.6, 3.2],
        size0: 1.6,
        size1: 0.9,
        growth: 1,
        color0: [0, 0, 0],
        color1: [0, 0, 0],
        alpha: 1,
        fadeIn: 0,
        fadeOut: 0.6,
        heat: 1,
        cool: 3,
        emissive: 45,
        additive: 1,
        drag: 0.7,
        buoyancy: 0,
        gravity: 6,
        wind: 0,
        spin: 0,
        frames: [FRAME_GLOW, FRAME_GLOW],
        stretch: 0,
        collide: false
    },

    // the thin white smoke a flare leaves behind
    flareSmoke: {
        life: [1.6, 2.4],
        size0: 0.6,
        size1: 3.2,
        growth: 2,
        color0: [0.85, 0.85, 0.85],
        color1: [0.7, 0.7, 0.72],
        alpha: 0.45,
        fadeIn: 0.02,
        fadeOut: 1.5,
        heat: 0,
        cool: 1,
        emissive: 0,
        additive: 0,
        drag: 1,
        buoyancy: 0.4,
        gravity: 0,
        wind: 1,
        spin: 0.6,
        frames: [0, 5],
        stretch: 0,
        collide: false
    },

    // the glow of the navigation lights, drawn for one frame - a colored glow takes its color from
    // the albedo rather than from the heat
    navRed: {
        life: [0, 0],
        size0: 0.5,
        size1: 0.5,
        growth: 1,
        color0: [1, 0.06, 0.03],
        color1: [1, 0.06, 0.03],
        alpha: 0.6,
        fadeIn: 0,
        fadeOut: 0,
        heat: 1,
        cool: 1e9,
        emissive: 12,
        additive: 1,
        drag: 0,
        buoyancy: 0,
        gravity: 0,
        wind: 0,
        spin: 0,
        frames: [FRAME_GLOW, FRAME_GLOW],
        stretch: 0,
        collide: false
    },

    navGreen: {
        life: [0, 0],
        size0: 0.5,
        size1: 0.5,
        growth: 1,
        color0: [0.05, 1, 0.25],
        color1: [0.05, 1, 0.25],
        alpha: 0.6,
        fadeIn: 0,
        fadeOut: 0,
        heat: 1,
        cool: 1e9,
        emissive: 12,
        additive: 1,
        drag: 0,
        buoyancy: 0,
        gravity: 0,
        wind: 0,
        spin: 0,
        frames: [FRAME_GLOW, FRAME_GLOW],
        stretch: 0,
        collide: false
    },

    // a billboard drawn for exactly one frame, such as the glow in a jet nozzle
    glow: {
        life: [0, 0],
        size0: 1,
        size1: 1,
        growth: 1,
        color0: [0, 0, 0],
        color1: [0, 0, 0],
        alpha: 1,
        fadeIn: 0,
        fadeOut: 0,
        heat: 1,
        cool: 1e9,
        emissive: 12,
        additive: 1,
        drag: 0,
        buoyancy: 0,
        gravity: 0,
        wind: 0,
        spin: 0,
        frames: [FRAME_GLOW, FRAME_GLOW],
        stretch: 0,
        collide: false
    }
};

const PRESET_LIST = Object.values(PRESETS);
PRESET_LIST.forEach((preset, index) => {
    preset.index = index;
});

// four vec4 per particle - position and size, albedo and opacity, rotation / frame / heat / emissive,
// and the streak vector with the additive amount
const FLOATS_PER_PARTICLE = 16;

/**
 * The shared pool of smoke and fire particles, drawn in one instanced, depth sorted draw call.
 */
class ParticleSystem {
    /**
     * @param {AppBase} app - The application.
     * @param {number} capacity - The most particles that can be alive at once.
     * @param {(x: number, z: number) => number} groundHeight - The height of the ground.
     */
    constructor(app, capacity, groundHeight) {
        const device = app.graphicsDevice;
        this.capacity = capacity;
        this.groundHeight = groundHeight;
        this.count = 0;

        // the wind that carries all smoke along, which is what makes trails drift and lean
        this.wind = new Vec3(3, 0, 1);

        // the state of every live particle, packed so the live ones are always the first `count`
        this.px = new Float32Array(capacity);
        this.py = new Float32Array(capacity);
        this.pz = new Float32Array(capacity);
        this.vx = new Float32Array(capacity);
        this.vy = new Float32Array(capacity);
        this.vz = new Float32Array(capacity);
        this.age = new Float32Array(capacity);
        this.life = new Float32Array(capacity);
        this.rotation = new Float32Array(capacity);
        this.spin = new Float32Array(capacity);
        this.scale = new Float32Array(capacity);
        this.opacity = new Float32Array(capacity);
        this.frame = new Float32Array(capacity);
        this.preset = new Uint8Array(capacity);

        // the per frame view of the particles, as rendered
        this.size = new Float32Array(capacity);
        this.keys = new Uint32Array(capacity);
        this.instanceData = new Float32Array(capacity * FLOATS_PER_PARTICLE);

        const format = new VertexFormat(device, [
            { semantic: SEMANTIC_ATTR10, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR11, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR12, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR13, components: 4, type: TYPE_FLOAT32 }
        ]);
        this.instanceBuffer = new VertexBuffer(device, format, capacity, {
            usage: BUFFER_DYNAMIC,
            data: this.instanceData
        });

        const quad = new Mesh(device);
        quad.setPositions(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]));
        quad.setIndices([0, 1, 2, 0, 2, 3]);
        quad.update(PRIMITIVE_TRIANGLES);

        this.atlas = createAtlas(device);

        const material = new ShaderMaterial({
            uniqueName: 'SplashOneParticles',
            vertexGLSL: particleVertexGLSL,
            fragmentGLSL: particleFragmentGLSL,
            vertexWGSL: particleVertexWGSL,
            fragmentWGSL: particleFragmentWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                aPosSize: SEMANTIC_ATTR10,
                aColor: SEMANTIC_ATTR11,
                aParams: SEMANTIC_ATTR12,
                aStretch: SEMANTIC_ATTR13
            }
        });
        material.blendType = BLEND_PREMULTIPLIED;
        material.depthWrite = false;
        material.cull = CULLFACE_NONE;
        material.setParameter('uAtlas', this.atlas);
        material.update();
        this.material = material;

        this.meshInstance = new MeshInstance(quad, material);
        this.meshInstance.setInstancing(this.instanceBuffer);
        this.meshInstance.instancingCount = 0;
        this.meshInstance.cull = false;

        this.entity = new Entity('Particles');
        this.entity.addComponent('render', {
            meshInstances: [this.meshInstance],
            castShadows: false,
            receiveShadows: false
        });
        app.root.addChild(this.entity);
    }

    /**
     * Spawns a particle.
     *
     * @param {ParticlePreset} preset - What kind of particle it is.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @param {number} vx - The x velocity.
     * @param {number} vy - The y velocity.
     * @param {number} vz - The z velocity.
     * @param {number} [scale] - A scale applied to its size.
     * @param {number} [opacity] - A scale applied to its opacity.
     * @param {number} [lifeScale] - A scale applied to its lifetime.
     */
    spawn(preset, x, y, z, vx, vy, vz, scale = 1, opacity = 1, lifeScale = 1) {
        if (this.count >= this.capacity) {
            return;
        }
        const i = this.count++;
        this.px[i] = x;
        this.py[i] = y;
        this.pz[i] = z;
        this.vx[i] = vx;
        this.vy[i] = vy;
        this.vz[i] = vz;
        this.age[i] = 0;
        this.life[i] = math.lerp(preset.life[0], preset.life[1], Math.random()) * lifeScale;
        this.rotation[i] = Math.random() * Math.PI * 2;
        this.spin[i] = (Math.random() * 2 - 1) * preset.spin;
        this.scale[i] = scale;
        this.opacity[i] = opacity;
        this.frame[i] = preset.frames[0] + Math.floor(Math.random() * (preset.frames[1] - preset.frames[0] + 0.999));
        this.preset[i] = preset.index ?? 0;
    }

    /**
     * Removes every particle.
     */
    clear() {
        this.count = 0;
    }

    /**
     * Moves a particle into the slot of a dead one, keeping the live particles packed.
     *
     * @param {number} from - The slot to move.
     * @param {number} to - The slot to move it to.
     * @private
     */
    _move(from, to) {
        this.px[to] = this.px[from];
        this.py[to] = this.py[from];
        this.pz[to] = this.pz[from];
        this.vx[to] = this.vx[from];
        this.vy[to] = this.vy[from];
        this.vz[to] = this.vz[from];
        this.age[to] = this.age[from];
        this.life[to] = this.life[from];
        this.rotation[to] = this.rotation[from];
        this.spin[to] = this.spin[from];
        this.scale[to] = this.scale[from];
        this.opacity[to] = this.opacity[from];
        this.frame[to] = this.frame[from];
        this.preset[to] = this.preset[from];
    }

    /**
     * Simulates the particles, sorts them back to front and uploads them for rendering.
     *
     * @param {number} dt - The time step.
     * @param {Vec3} cameraPosition - The position of the camera.
     * @param {Vec3} cameraForward - The direction the camera looks in.
     */
    update(dt, cameraPosition, cameraForward) {
        const { px, py, pz, vx, vy, vz, age, life, size, keys } = this;
        const windX = this.wind.x * dt;
        const windY = this.wind.y * dt;
        const windZ = this.wind.z * dt;
        const groundHeight = this.groundHeight;

        let i = 0;
        while (i < this.count) {
            // retired after being drawn at the very end of its life, so even a particle meant to
            // last a single frame is seen once
            if (age[i] >= life[i] && age[i] > 0) {
                this.count--;
                if (i !== this.count) {
                    this._move(this.count, i);
                }
                continue;
            }

            const preset = PRESET_LIST[this.preset[i]];
            age[i] += dt;

            const drag = Math.exp(-preset.drag * dt);
            vx[i] *= drag;
            vy[i] = vy[i] * drag + (preset.buoyancy - preset.gravity) * dt;
            vz[i] *= drag;

            px[i] += vx[i] * dt + windX * preset.wind;
            py[i] += vy[i] * dt + windY * preset.wind;
            pz[i] += vz[i] * dt + windZ * preset.wind;

            if (preset.collide) {
                const ground = groundHeight(px[i], pz[i]);
                if (py[i] < ground) {
                    py[i] = ground;
                    vy[i] = Math.abs(vy[i]) * 0.3;
                    vx[i] *= 0.5;
                    vz[i] *= 0.5;
                    this.spin[i] *= 0.5;
                }
            }

            this.rotation[i] += this.spin[i] * dt;
            i++;
        }

        // sort far to near, packing the quantized depth and the slot into one key so the typed
        // array sorts natively, without a comparison callback
        const count = this.count;
        const fx = cameraForward.x;
        const fy = cameraForward.y;
        const fz = cameraForward.z;
        const cx = cameraPosition.x;
        const cy = cameraPosition.y;
        const cz = cameraPosition.z;
        for (let p = 0; p < count; p++) {
            const depth = (px[p] - cx) * fx + (py[p] - cy) * fy + (pz[p] - cz) * fz;
            const quantized = math.clamp(Math.floor(depth * 4) + 4096, 0, 65535);
            keys[p] = (((65535 - quantized) << 16) | p) >>> 0;
        }
        const sorted = keys.subarray(0, count);
        sorted.sort();

        const data = this.instanceData;
        for (let s = 0; s < count; s++) {
            const p = sorted[s] & 0xffff;
            const preset = PRESET_LIST[this.preset[p]];
            const t = life[p] > 0 ? Math.min(age[p] / life[p], 1) : 0;

            const grown = 1 - Math.pow(1 - t, preset.growth);
            size[p] = math.lerp(preset.size0, preset.size1, grown) * this.scale[p];

            const fadeIn = preset.fadeIn > 0 ? Math.min(t / preset.fadeIn, 1) : 1;
            const fadeOut = preset.fadeOut > 0 ? Math.pow(1 - t, preset.fadeOut) : 1;
            const alpha = preset.alpha * fadeIn * fadeOut * this.opacity[p];

            const heat = preset.heat * Math.max(0, 1 - t / preset.cool);

            const o = s * FLOATS_PER_PARTICLE;
            data[o] = px[p];
            data[o + 1] = py[p];
            data[o + 2] = pz[p];
            data[o + 3] = size[p];
            data[o + 4] = math.lerp(preset.color0[0], preset.color1[0], t);
            data[o + 5] = math.lerp(preset.color0[1], preset.color1[1], t);
            data[o + 6] = math.lerp(preset.color0[2], preset.color1[2], t);
            data[o + 7] = alpha;
            data[o + 8] = this.rotation[p];
            data[o + 9] = this.frame[p];
            data[o + 10] = heat;
            data[o + 11] = preset.emissive;

            // streaks trail behind the way they came
            const stretch = preset.stretch;
            data[o + 12] = -vx[p] * stretch;
            data[o + 13] = -vy[p] * stretch;
            data[o + 14] = -vz[p] * stretch;
            data[o + 15] = preset.additive;
        }

        if (count > 0) {
            this.instanceBuffer.unlock(0, count * FLOATS_PER_PARTICLE * 4);
        }
        this.meshInstance.instancingCount = count;
        this.meshInstance.visible = count > 0;
    }
}

// --------------------------------------------------------------------------------------------
// ribbons

const RIBBON_POINT_FLOATS = 6;

/**
 * A trail of recent positions, drawn as a camera facing strip.
 */
export class Ribbon {
    /**
     * @param {number} capacity - The most points it keeps.
     * @param {number} lifetime - How long a point lasts, in seconds.
     * @param {number} spacing - How far apart points are laid, in meters.
     */
    constructor(capacity, lifetime, spacing) {
        this.capacity = capacity;
        this.lifetime = lifetime;
        this.spacing = spacing;

        // a ring of x, y, z, time, width and intensity
        this.points = new Float32Array(capacity * RIBBON_POINT_FLOATS);
        this.head = 0;
        this.count = 0;
        this.active = true;

        // how many times wider it is by the end of its life, how much the wind carries it, and how far
        // behind the emitter it fades in, in meters
        this.growth = 2.5;
        this.drift = 0;
        this.fadeIn = 0;

        // held by an emitter, rather than left to fade out before it is reused
        this.owned = true;

        // the points drawn last frame - past these, its strip is already collapsed
        this.drawn = 0;
    }

    /**
     * Whether every point of the trail has faded out.
     *
     * @param {number} time - The current time.
     * @returns {boolean} True when nothing of it is left.
     */
    expired(time) {
        return this.count === 0 || time - this.newest >= this.lifetime;
    }

    /**
     * The time the newest point was laid at.
     *
     * @type {number}
     */
    get newest() {
        const last = ((this.head - 1 + this.capacity) % this.capacity) * RIBBON_POINT_FLOATS;
        return this.count > 0 ? this.points[last + 3] : -Infinity;
    }

    /**
     * Moves the end of the trail to the emitter, laying a new point once it has moved far enough
     * from the last one.
     *
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @param {number} time - The current time.
     * @param {number} width - The width of the trail here.
     * @param {number} intensity - How visible the trail is here.
     */
    push(x, y, z, time, width, intensity) {
        const points = this.points;
        if (this.count >= 2) {
            // the newest point follows the emitter, and is left behind once it is far enough from
            // the one before it
            const prev = ((this.head - 2 + this.capacity) % this.capacity) * RIBBON_POINT_FLOATS;
            const dx = x - points[prev];
            const dy = y - points[prev + 1];
            const dz = z - points[prev + 2];
            if (dx * dx + dy * dy + dz * dz < this.spacing * this.spacing) {
                const last = ((this.head - 1 + this.capacity) % this.capacity) * RIBBON_POINT_FLOATS;
                points[last] = x;
                points[last + 1] = y;
                points[last + 2] = z;
                points[last + 3] = time;
                points[last + 4] = width;
                points[last + 5] = intensity;
                return;
            }
        }

        const o = this.head * RIBBON_POINT_FLOATS;
        points[o] = x;
        points[o + 1] = y;
        points[o + 2] = z;
        points[o + 3] = time;
        points[o + 4] = width;
        points[o + 5] = intensity;
        this.head = (this.head + 1) % this.capacity;
        this.count = Math.min(this.count + 1, this.capacity);
    }

    /**
     * Breaks the trail, so the next point starts a new one rather than joining across a jump.
     */
    reset() {
        this.count = 0;
    }
}

/**
 * Draws every ribbon in one dynamic mesh.
 */
class RibbonRenderer {
    /**
     * @param {AppBase} app - The application.
     * @param {number} maxRibbons - The most ribbons.
     * @param {number} maxPoints - The most points per ribbon.
     */
    constructor(app, maxRibbons, maxPoints) {
        const device = app.graphicsDevice;
        this.maxRibbons = maxRibbons;
        this.maxPoints = maxPoints;

        /** @type {Ribbon[]} */
        this.ribbons = [];
        this.time = 0;

        const maxVertices = maxRibbons * maxPoints * 2;
        this.vertexData = new Float32Array(maxVertices * 7);

        const format = new VertexFormat(device, [
            { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR10, components: 4, type: TYPE_FLOAT32 }
        ]);
        this.vertexBuffer = new VertexBuffer(device, format, maxVertices, {
            usage: BUFFER_DYNAMIC,
            data: this.vertexData
        });

        // two triangles between every pair of points of every ribbon, laid out up front
        const indices = new Uint32Array(maxRibbons * (maxPoints - 1) * 6);
        let index = 0;
        for (let r = 0; r < maxRibbons; r++) {
            for (let p = 0; p < maxPoints - 1; p++) {
                const v = (r * maxPoints + p) * 2;
                indices[index++] = v;
                indices[index++] = v + 1;
                indices[index++] = v + 2;
                indices[index++] = v + 1;
                indices[index++] = v + 3;
                indices[index++] = v + 2;
            }
        }
        this.indexBuffer = new IndexBuffer(device, INDEXFORMAT_UINT32, indices.length, BUFFER_STATIC, indices);

        const mesh = new Mesh(device);
        mesh.vertexBuffer = this.vertexBuffer;
        mesh.indexBuffer[0] = this.indexBuffer;
        mesh.primitive[0].type = PRIMITIVE_TRIANGLES;
        mesh.primitive[0].base = 0;
        mesh.primitive[0].count = 0;
        mesh.primitive[0].indexed = true;
        this.mesh = mesh;

        const material = new ShaderMaterial({
            uniqueName: 'SplashOneRibbons',
            vertexGLSL: ribbonVertexGLSL,
            fragmentGLSL: ribbonFragmentGLSL,
            vertexWGSL: ribbonVertexWGSL,
            fragmentWGSL: ribbonFragmentWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                aData: SEMANTIC_ATTR10
            }
        });
        material.blendType = BLEND_PREMULTIPLIED;
        material.depthWrite = false;
        material.cull = CULLFACE_NONE;
        material.update();
        this.material = material;

        this.meshInstance = new MeshInstance(mesh, material);
        this.meshInstance.cull = false;

        this.entity = new Entity('Ribbons');
        this.entity.addComponent('render', {
            meshInstances: [this.meshInstance],
            castShadows: false,
            receiveShadows: false
        });
        app.root.addChild(this.entity);
    }

    /**
     * Creates a ribbon.
     *
     * @param {number} lifetime - How long a point of it lasts, in seconds.
     * @param {number} spacing - How far apart its points are laid, in meters.
     * @returns {Ribbon} The ribbon.
     */
    create(lifetime, spacing) {
        const ribbon = new Ribbon(this.maxPoints, lifetime, spacing);
        if (this.ribbons.length < this.maxRibbons) {
            this.ribbons.push(ribbon);
        }
        return ribbon;
    }

    /**
     * Takes a ribbon for an emitter to lay a trail with - one whose trail has faded out, or a new one.
     * Once released, its trail is left to fade out before it is taken again, so a trail outlives what
     * laid it.
     *
     * @param {number} lifetime - How long a point of it lasts, in seconds.
     * @param {number} spacing - How far apart its points are laid, in meters.
     * @param {number} growth - How many times wider it is by the end of its life.
     * @param {number} drift - How much the wind carries it.
     * @param {number} fadeIn - How far behind the emitter it fades in, in meters.
     * @returns {Ribbon} The ribbon.
     */
    acquire(lifetime, spacing, growth, drift, fadeIn) {
        let ribbon = null;
        let oldest = null;
        for (let i = 0; i < this.ribbons.length; i++) {
            const candidate = this.ribbons[i];
            if (!candidate.owned) {
                if (candidate.expired(this.time)) {
                    ribbon = candidate;
                    break;
                }
                if (!oldest || candidate.newest < oldest.newest) {
                    oldest = candidate;
                }
            }
        }
        // with every ribbon in use, the trail that has been fading longest makes way
        ribbon ??= this.ribbons.length < this.maxRibbons ? this.create(lifetime, spacing) : oldest;
        ribbon ??= new Ribbon(this.maxPoints, lifetime, spacing);

        ribbon.reset();
        ribbon.owned = true;
        ribbon.lifetime = lifetime;
        ribbon.spacing = spacing;
        ribbon.growth = growth;
        ribbon.drift = drift;
        ribbon.fadeIn = fadeIn;
        return ribbon;
    }

    /**
     * Lets go of a ribbon taken with {@link RibbonRenderer#acquire}, leaving its trail to fade out.
     *
     * @param {Ribbon} ribbon - The ribbon.
     */
    release(ribbon) {
        ribbon.owned = false;
    }

    /**
     * Wipes every trail.
     */
    clear() {
        for (let i = 0; i < this.ribbons.length; i++) {
            this.ribbons[i].reset();
        }
    }

    /**
     * Rebuilds the strips for the current camera.
     *
     * @param {number} time - The current time.
     * @param {Vec3} cameraPosition - The position of the camera.
     * @param {Vec3} wind - The wind, which carries the trails that drift with it.
     * @param {number} pixelSize - The size of a pixel one meter from the camera, in meters.
     */
    update(time, cameraPosition, wind, pixelSize) {
        const data = this.vertexData;
        const maxPoints = this.maxPoints;
        let usedSegments = 0;
        let usedVertices = 0;
        this.time = time;

        for (let r = 0; r < this.ribbons.length; r++) {
            const ribbon = this.ribbons[r];
            const base = r * maxPoints;
            const points = ribbon.points;
            const capacity = ribbon.capacity;

            // the live points, oldest first
            let first = 0;
            const count = ribbon.count;
            while (first < count) {
                const o = ((ribbon.head - count + first + capacity) % capacity) * RIBBON_POINT_FLOATS;
                if (time - points[o + 3] < ribbon.lifetime) {
                    break;
                }
                first++;
            }

            // the wind carries a point along for as long as it has been in the air, and the trail
            // fades in behind the emitter, at the newest point
            const driftX = wind.x * ribbon.drift;
            const driftY = wind.y * ribbon.drift;
            const driftZ = wind.z * ribbon.drift;
            const fadeIn = ribbon.fadeIn;
            const newest = ((ribbon.head - 1 + capacity) % capacity) * RIBBON_POINT_FLOATS;
            const headX = points[newest];
            const headY = points[newest + 1];
            const headZ = points[newest + 2];

            let written = 0;
            for (let k = first; k < count; k++) {
                const o = ((ribbon.head - count + k + capacity) % capacity) * RIBBON_POINT_FLOATS;
                const prev =
                    ((ribbon.head - count + Math.max(k - 1, first) + capacity) % capacity) * RIBBON_POINT_FLOATS;
                const next =
                    ((ribbon.head - count + Math.min(k + 1, count - 1) + capacity) % capacity) * RIBBON_POINT_FLOATS;

                const seconds = time - points[o + 3];
                const x = points[o] + driftX * seconds;
                const y = points[o + 1] + driftY * seconds;
                const z = points[o + 2] + driftZ * seconds;

                // the side vector faces the camera and runs across the direction of the trail
                const tx = points[next] - points[prev];
                const ty = points[next + 1] - points[prev + 1];
                const tz = points[next + 2] - points[prev + 2];
                const cx = cameraPosition.x - x;
                const cy = cameraPosition.y - y;
                const cz = cameraPosition.z - z;
                let sx = ty * cz - tz * cy;
                let sy = tz * cx - tx * cz;
                let sz = tx * cy - ty * cx;
                const length = Math.hypot(sx, sy, sz) || 1;

                // Trails spread and fade as they age, and taper in at the emitter. The oldest few
                // points fade out too, for a trail long enough to fill its ring, whose end would
                // otherwise be cut off.
                const age = math.clamp(seconds / ribbon.lifetime, 0, 1);
                let width = points[o + 4] * (1 + age * ribbon.growth) * Math.min(1, (count - 1 - k) * 0.5 + 0.35);
                let alpha = points[o + 5] * (1 - age) * (1 - age) * Math.min(1, (k - first) * 0.25);

                // Far off, a trail only a pixel or so wide would break up into dashes as it crosses
                // the rows of pixels, its soft edges missing them, so it is kept two and a half pixels
                // wide, and made fainter to match.
                const minWidth = Math.hypot(cx, cy, cz) * pixelSize * 1.25;
                let thin = 0;
                if (width < minWidth) {
                    thin = 1 - width / minWidth;
                    alpha *= width / minWidth;
                    width = minWidth;
                }
                if (fadeIn > 0) {
                    const t = Math.min(1, Math.hypot(x - headX, y - headY, z - headZ) / fadeIn);
                    alpha *= t * t * (3 - 2 * t);
                }

                sx *= width / length;
                sy *= width / length;
                sz *= width / length;

                const v = (base + written) * 2 * 7;
                data[v] = x - sx;
                data[v + 1] = y - sy;
                data[v + 2] = z - sz;
                data[v + 3] = alpha;
                data[v + 4] = -1;
                data[v + 5] = age;
                data[v + 6] = thin;
                data[v + 7] = x + sx;
                data[v + 8] = y + sy;
                data[v + 9] = z + sz;
                data[v + 10] = alpha;
                data[v + 11] = 1;
                data[v + 12] = age;
                data[v + 13] = thin;
                written++;
            }

            // collapse the unused tail of the ribbon onto its last point so it draws nothing - only as
            // far as it was drawn last frame, as the rest of it already is
            const lastWritten = written > 0 ? (base + written - 1) * 2 * 7 : -1;
            const collapseEnd = Math.min(maxPoints, Math.max(written, ribbon.drawn) + 1);
            ribbon.drawn = written;
            for (let k = written; k < collapseEnd; k++) {
                const v = (base + k) * 2 * 7;
                for (let c = 0; c < 14; c++) {
                    data[v + c] = lastWritten >= 0 ? data[lastWritten + (c % 7)] : 0;
                }
                data[v + 3] = 0;
                data[v + 10] = 0;
            }

            usedSegments = r * (maxPoints - 1) + Math.max(written - 1, 0);
            usedVertices = (base + maxPoints) * 2;
        }

        if (usedVertices > 0) {
            this.vertexBuffer.unlock(0, usedVertices * 7 * 4);
        }
        this.mesh.primitive[0].count = usedSegments * 6;
        this.meshInstance.visible = usedSegments > 0;
    }
}

// --------------------------------------------------------------------------------------------
// wakes

// The foam of a wake on the water, lit like the foam of the water itself. Each vertex carries how far
// across its strip it is, its opacity, and which kind of strip it is - the churned water behind the
// stern, or an arm of the bow wave. The foam is clumped by noise in world space, so it stays put on
// the water as the ship sails on, and the strips are lifted off the water a little more with distance,
// where the depth buffer can no longer tell them apart.
const wakeVertexGLSL = /* glsl */ `
    attribute vec3 vertex_position;
    attribute vec4 aData;

    uniform mat4 matrix_viewProjection;
    uniform vec3 view_position;

    varying vec4 vData;
    varying vec3 vWorldPos;

    void main(void) {
        vec3 p = vertex_position;
        p.y += 0.25 + distance(view_position, p) * 0.0004;
        gl_Position = matrix_viewProjection * vec4(p, 1.0);
        vData = aData;
        vWorldPos = p;
    }
`;

const wakeFragmentGLSL = /* glsl */ `
    #include "gammaPS"

    ${atmosphereChunks.glsl}

    uniform vec3 view_position;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;

    varying vec4 vData;
    varying vec3 vWorldPos;

    float wakeHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float wakeNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = wakeHash(i);
        float b = wakeHash(i + vec2(1.0, 0.0));
        float c = wakeHash(i + vec2(0.0, 1.0));
        float d = wakeHash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main(void) {
        vec2 p = vWorldPos.xz;
        float n = wakeNoise(p * 0.3) * 0.55 + wakeNoise(p * 1.1 + 7.3) * 0.3 + wakeNoise(p * 3.7 - 2.1) * 0.15;
        float across = abs(vData.x);
        float body = 1.0 - across;
        // the foam thins out into patches as it ages
        float age = vData.w;
        float foam = vData.z < 0.5 ?
            smoothstep(0.3 + age * 0.3, 0.72 + age * 0.15, n + body * 0.45 - 0.15) * smoothstep(0.0, 0.35, body) :
            smoothstep(0.42 + age * 0.25, 0.68 + age * 0.15, n + body * 0.45 - 0.2) * body;
        float alpha = foam * vData.y;
        float sunUp = max(uSunDir.y, 0.0);
        vec3 color = (uSkyColor + uSunColor * sunUp) * 0.75;
        color = atmosphereApply(color, view_position, vWorldPos, 1.0);
        gl_FragColor = vec4(gammaCorrectOutput(color), alpha);
    }
`;

const wakeVertexWGSL = /* wgsl */ `
    attribute vertex_position: vec3f;
    attribute aData: vec4f;

    uniform matrix_viewProjection: mat4x4f;
    uniform view_position: vec3f;

    varying vData: vec4f;
    varying vWorldPos: vec3f;

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        var p = input.vertex_position;
        p.y = p.y + 0.25 + distance(uniform.view_position, p) * 0.0004;
        output.position = uniform.matrix_viewProjection * vec4f(p, 1.0);
        output.vData = input.aData;
        output.vWorldPos = p;
        return output;
    }
`;

const wakeFragmentWGSL = /* wgsl */ `
    #include "gammaPS"

    ${atmosphereChunks.wgsl}

    uniform view_position: vec3f;
    uniform uSunDir: vec3f;
    uniform uSunColor: vec3f;
    uniform uSkyColor: vec3f;

    varying vData: vec4f;
    varying vWorldPos: vec3f;

    fn wakeHash(p: vec2f) -> f32 {
        return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
    }

    fn wakeNoise(p: vec2f) -> f32 {
        let i = floor(p);
        var f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        let a = wakeHash(i);
        let b = wakeHash(i + vec2f(1.0, 0.0));
        let c = wakeHash(i + vec2f(0.0, 1.0));
        let d = wakeHash(i + vec2f(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let p = input.vWorldPos.xz;
        let n = wakeNoise(p * 0.3) * 0.55 + wakeNoise(p * 1.1 + 7.3) * 0.3 + wakeNoise(p * 3.7 - 2.1) * 0.15;
        let across = abs(input.vData.x);
        let body = 1.0 - across;
        // the foam thins out into patches as it ages
        let age = input.vData.w;
        var foam: f32;
        if (input.vData.z < 0.5) {
            foam = smoothstep(0.3 + age * 0.3, 0.72 + age * 0.15, n + body * 0.45 - 0.15) * smoothstep(0.0, 0.35, body);
        } else {
            foam = smoothstep(0.42 + age * 0.25, 0.68 + age * 0.15, n + body * 0.45 - 0.2) * body;
        }
        let alpha = foam * input.vData.y;
        let sunUp = max(uniform.uSunDir.y, 0.0);
        var color = (uniform.uSkyColor + uniform.uSunColor * sunUp) * 0.75;
        color = atmosphereApply(color, uniform.view_position, input.vWorldPos, 1.0);
        output.color = vec4f(gammaCorrectOutput(color), alpha);
        return output;
    }
`;

// the floats stored for each point of a wake - x, z, the direction across the path, the distance sailed
// when it was laid, the time it was laid, and the speed of the ship then
const WAKE_POINT_FLOATS = 7;

// the angle the arms of a bow wave spread at, whatever the speed - the Kelvin angle
const KELVIN_SPREAD = Math.tan(19.47 * math.DEG_TO_RAD);

/**
 * The wake of a ship - a history of where its bow has been, from which the wake is drawn: the churned
 * water behind the stern, widening and fading as it falls behind, and the two arms of the bow wave
 * spreading out from the bow.
 */
export class Wake {
    /**
     * @param {number} capacity - The most points it keeps.
     * @param {number} length - The length of the ship.
     * @param {number} beam - The width of the ship.
     */
    constructor(capacity, length, beam) {
        this.capacity = capacity;
        this.length = length;
        this.beam = beam;
        this.points = new Float32Array(capacity * WAKE_POINT_FLOATS);
        this.count = 0;
        this.head = 0;
        this.distance = 0;
        this.lastX = 0;
        this.lastZ = 0;
        this.started = false;
    }

    /**
     * Moves the wake on with the ship.
     *
     * @param {number} x - The x of the bow.
     * @param {number} z - The z of the bow.
     * @param {number} dirX - The x of the direction the ship sails in.
     * @param {number} dirZ - The z of the direction the ship sails in.
     * @param {number} speed - How fast it sails.
     * @param {number} time - The current time.
     */
    update(x, z, dirX, dirZ, speed, time) {
        if (!this.started) {
            this.started = true;
            this.lastX = x;
            this.lastZ = z;
        }
        const moved = Math.hypot(x - this.lastX, z - this.lastZ);
        if (moved < 4 && this.count > 0) {
            return;
        }
        this.distance += moved;
        this.lastX = x;
        this.lastZ = z;
        const o = this.head * WAKE_POINT_FLOATS;
        const points = this.points;
        points[o] = x;
        points[o + 1] = z;
        points[o + 2] = -dirZ;
        points[o + 3] = dirX;
        points[o + 4] = this.distance;
        points[o + 5] = time;
        points[o + 6] = speed;
        this.head = (this.head + 1) % this.capacity;
        this.count = Math.min(this.count + 1, this.capacity);
    }

    /**
     * Clears the wake.
     */
    reset() {
        this.count = 0;
        this.head = 0;
        this.distance = 0;
        this.started = false;
    }
}

// the strips of a wake - the churned water, and the two arms of the bow wave
const WAKE_STRIPS = 3;

/**
 * Draws every wake in one dynamic mesh, on the water's own layer, just after the water.
 */
class WakeRenderer {
    /**
     * @param {AppBase} app - The application.
     * @param {Layer} layer - The layer the water is drawn in.
     * @param {number} maxWakes - The most wakes.
     * @param {number} maxPoints - The most points a wake keeps.
     */
    constructor(app, layer, maxWakes, maxPoints) {
        const device = app.graphicsDevice;
        this.maxWakes = maxWakes;
        this.maxPoints = maxPoints;

        // how long the churned water and the arms of the bow wave last, in seconds
        this.trailLife = 70;
        this.armLife = 32;

        /** @type {Wake[]} */
        this.wakes = [];

        const strips = maxWakes * WAKE_STRIPS;
        const maxVertices = strips * maxPoints * 2;
        this.vertexData = new Float32Array(maxVertices * 7);
        const format = new VertexFormat(device, [
            { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR10, components: 4, type: TYPE_FLOAT32 }
        ]);
        this.vertexBuffer = new VertexBuffer(device, format, maxVertices, {
            usage: BUFFER_DYNAMIC,
            data: this.vertexData
        });
        const indices = new Uint32Array(strips * (maxPoints - 1) * 6);
        let index = 0;
        for (let r = 0; r < strips; r++) {
            for (let k = 0; k < maxPoints - 1; k++) {
                const v = (r * maxPoints + k) * 2;
                indices[index++] = v;
                indices[index++] = v + 1;
                indices[index++] = v + 2;
                indices[index++] = v + 1;
                indices[index++] = v + 3;
                indices[index++] = v + 2;
            }
        }
        this.indexBuffer = new IndexBuffer(device, INDEXFORMAT_UINT32, indices.length, BUFFER_STATIC, indices);

        const mesh = new Mesh(device);
        mesh.vertexBuffer = this.vertexBuffer;
        mesh.indexBuffer[0] = this.indexBuffer;
        mesh.primitive[0].type = PRIMITIVE_TRIANGLES;
        mesh.primitive[0].base = 0;
        mesh.primitive[0].count = 0;
        mesh.primitive[0].indexed = true;
        this.mesh = mesh;

        const material = new ShaderMaterial({
            uniqueName: 'SplashOneWakes',
            vertexGLSL: wakeVertexGLSL,
            fragmentGLSL: wakeFragmentGLSL,
            vertexWGSL: wakeVertexWGSL,
            fragmentWGSL: wakeFragmentWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                aData: SEMANTIC_ATTR10
            }
        });
        material.blendType = BLEND_NORMAL;
        material.depthWrite = false;
        material.cull = CULLFACE_NONE;
        material.update();
        this.material = material;

        // drawn after the water, which is drawn first in the layer
        this.meshInstance = new MeshInstance(mesh, material);
        this.meshInstance.cull = false;
        this.meshInstance.drawOrder = 1;

        this.entity = new Entity('Wakes');
        this.entity.addComponent('render', {
            meshInstances: [this.meshInstance],
            layers: [layer.id],
            castShadows: false,
            receiveShadows: false
        });
        app.root.addChild(this.entity);
    }

    /**
     * Creates a wake.
     *
     * @param {number} length - The length of the ship.
     * @param {number} beam - The width of the ship.
     * @returns {Wake} The wake.
     */
    create(length, beam) {
        const wake = new Wake(this.maxPoints, length, beam);
        if (this.wakes.length < this.maxWakes) {
            this.wakes.push(wake);
        }
        return wake;
    }

    /**
     * Removes a wake.
     *
     * @param {Wake} wake - The wake.
     */
    remove(wake) {
        const index = this.wakes.indexOf(wake);
        if (index !== -1) {
            this.wakes.splice(index, 1);
        }
    }

    /**
     * Rebuilds the strips.
     *
     * @param {number} time - The current time.
     */
    update(time) {
        const data = this.vertexData;
        const maxPoints = this.maxPoints;
        let strip = 0;
        let used = 0;

        /**
         * Writes a vertex.
         *
         * @param {number} v - The vertex.
         * @param {number} x - The x coordinate.
         * @param {number} z - The z coordinate.
         * @param {number} across - Where across its strip it is, -1 to 1.
         * @param {number} alpha - Its opacity.
         * @param {number} kind - The kind of strip.
         * @param {number} age - How old it is, as a fraction of the strip's life.
         */
        const vertex = (v, x, z, across, alpha, kind, age) => {
            const o = v * 7;
            data[o] = x;
            data[o + 1] = 0;
            data[o + 2] = z;
            data[o + 3] = across;
            data[o + 4] = alpha;
            data[o + 5] = kind;
            data[o + 6] = age;
        };

        for (let w = 0; w < this.wakes.length; w++) {
            const wake = this.wakes[w];
            const { points, capacity, count, length, beam } = wake;
            for (let s = 0; s < WAKE_STRIPS; s++) {
                const base = strip * maxPoints;
                let written = 0;
                for (let k = 0; k < count; k++) {
                    const o = ((wake.head - count + k + capacity) % capacity) * WAKE_POINT_FLOATS;
                    const x = points[o];
                    const z = points[o + 1];
                    const sx = points[o + 2];
                    const sz = points[o + 3];
                    const behind = wake.distance - points[o + 4];
                    const age = time - points[o + 5];
                    const strength = math.clamp(points[o + 6] / 12, 0, 1);
                    const v = (base + written) * 2;
                    if (s === 0) {
                        // the churned water, from the stern back, spreading slowly
                        const half = beam * 0.5 + Math.max(behind - length, 0) * 0.05 + age * 0.12;
                        const life = Math.min(age / this.trailLife, 1);
                        const alpha =
                            strength * 0.85 * math.smoothstep(length * 0.8, length * 1.02, behind) * (1 - life);
                        vertex(v, x - sx * half, z - sz * half, -1, alpha, 0, life);
                        vertex(v + 1, x + sx * half, z + sz * half, 1, alpha, 0, life);
                    } else {
                        // an arm of the bow wave, along the hull and then out at the Kelvin angle
                        const side = s === 1 ? -1 : 1;
                        const offset = Math.max(behind * KELVIN_SPREAD, Math.min(behind * 0.55, beam * 0.5)) + 0.5;
                        const half = 1.6 + behind * 0.015 + age * 0.08;
                        const life = Math.min(age / this.armLife, 1);
                        const alpha = strength * 0.55 * math.smoothstep(2, 14, behind) * (1 - life) * (1 - life);
                        const cx = x + sx * side * offset;
                        const cz = z + sz * side * offset;
                        vertex(v, cx - sx * half, cz - sz * half, -1, alpha, 1, life);
                        vertex(v + 1, cx + sx * half, cz + sz * half, 1, alpha, 1, life);
                    }
                    written++;
                }
                // the unused tail collapsed onto the last point, drawing nothing
                const last = written > 0 ? (base + written - 1) * 2 : -1;
                for (let k = written; k < maxPoints; k++) {
                    const v = (base + k) * 2;
                    for (let c = 0; c < 14; c++) {
                        data[v * 7 + c] = last >= 0 ? data[last * 7 + (c % 7)] : 0;
                    }
                    data[v * 7 + 4] = 0;
                    data[v * 7 + 11] = 0;
                }
                strip++;
                used = strip * maxPoints * 2;
            }
        }
        if (used > 0) {
            this.vertexBuffer.unlock(0, used * 7 * 4);
        }
        this.mesh.primitive[0].count = strip * (maxPoints - 1) * 6;
        this.meshInstance.visible = strip > 0;
    }
}

// --------------------------------------------------------------------------------------------
// the effects

/**
 * The state of something leaving a trail of particles behind it, so that they are laid evenly
 * along its path whatever the frame rate and however fast it moves.
 */
export class TrailState {
    hasLast = false;

    lastX = 0;

    lastY = 0;

    lastZ = 0;

    // how far along the path the next particle is due
    carry = 0;

    reset() {
        this.hasLast = false;
        this.carry = 0;
    }
}

const _tmp = new Vec3();

/**
 * A uniformly distributed random direction.
 *
 * @param {Vec3} out - Receives the direction.
 * @returns {Vec3} The direction.
 */
export const randomDirection = (out) => {
    const y = Math.random() * 2 - 1;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    return out.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
};

/**
 * Smoke, fire, flashes and trails, and the lights that go with them.
 */
export class Effects {
    /**
     * @param {AppBase} app - The application.
     * @param {(x: number, z: number) => number} groundHeight - The height of the ground.
     * @param {Layer} waterLayer - The layer the water is drawn in, which the wakes are drawn in too.
     */
    constructor(app, groundHeight, waterLayer) {
        this.app = app;
        this.groundHeight = groundHeight;
        this.particles = new ParticleSystem(app, 24000, groundHeight);
        this.ribbons = new RibbonRenderer(app, 128, 40);
        // the long trails - contrails, and the lines of missile smoke - which hang in the sky long
        // after what laid them is gone
        this.trails = new RibbonRenderer(app, 96, 200);
        this.wakes = new WakeRenderer(app, waterLayer, 8, 240);
        this.time = 0;

        // the lighting the smoke picks up, refreshed from the sky every frame
        // how much the brightness of fire is held back - below one at night, when the exposure is high
        this.emissiveScale = 1;
        this.particles.material.setParameter('uEmissiveScale', 1);

        this.sunDir = new Vec3(0, 1, 0);
        this.sunColor = new Color(1, 1, 1);
        this.skyColor = new Color(0.4, 0.5, 0.7);
        this.groundColor = new Color(0.15, 0.15, 0.12);

        // a few omni lights, borrowed by detonations to light up their surroundings
        this.lights = [];
        for (let i = 0; i < 8; i++) {
            const entity = new Entity('BlastLight');
            entity.addComponent('light', {
                type: 'omni',
                color: new Color(1, 0.55, 0.25),
                intensity: 0,
                range: 100,
                falloffMode: LIGHTFALLOFF_INVERSESQUARED,
                castShadows: false
            });
            entity.enabled = false;
            app.root.addChild(entity);
            this.lights.push({ entity, age: 0, duration: 1, intensity: 0, range: 0 });
        }

        /**
         * The shader parameters of every flame.
         *
         * @type {Map<Entity, Float32Array>}
         */
        this.flames = new Map();

        // the afterburner material, shared by every flame
        this.flameMaterial = new ShaderMaterial({
            uniqueName: 'SplashOneFlame',
            vertexGLSL: flameVertexGLSL,
            fragmentGLSL: flameFragmentGLSL,
            vertexWGSL: flameVertexWGSL,
            fragmentWGSL: flameFragmentWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                vertex_texCoord0: SEMANTIC_TEXCOORD0
            }
        });
        this.flameMaterial.blendType = BLEND_ADDITIVE;
        this.flameMaterial.depthWrite = false;
        this.flameMaterial.cull = CULLFACE_NONE;
        this.flameMaterial.update();
    }

    /**
     * Sets the lighting the smoke and trails pick up.
     *
     * @param {Vec3} sunDir - The direction towards the sun.
     * @param {Color} sunColor - The color of the sunlight, scaled by its intensity.
     * @param {Color} skyColor - The light coming from the sky.
     * @param {Color} groundColor - The light bouncing off the ground.
     */
    setLighting(sunDir, sunColor, skyColor, groundColor) {
        this.sunDir.copy(sunDir);
        this.sunColor.copy(sunColor);
        this.skyColor.copy(skyColor);
        this.groundColor.copy(groundColor);

        const sun = [sunDir.x, sunDir.y, sunDir.z];
        const sunLight = [sunColor.r, sunColor.g, sunColor.b];
        const sky = [skyColor.r, skyColor.g, skyColor.b];
        const ground = [groundColor.r, groundColor.g, groundColor.b];
        const material = this.particles.material;
        material.setParameter('uSunDir', sun);
        material.setParameter('uSunColor', sunLight);
        material.setParameter('uSkyColor', sky);
        material.setParameter('uGroundColor', ground);
        this.ribbons.material.setParameter('uSunColor', sunLight);
        this.ribbons.material.setParameter('uSkyColor', sky);
        this.trails.material.setParameter('uSunColor', sunLight);
        this.trails.material.setParameter('uSkyColor', sky);
        this.wakes.material.setParameter('uSunDir', sun);
        this.wakes.material.setParameter('uSunColor', sunLight);
        this.wakes.material.setParameter('uSkyColor', sky);
    }

    /**
     * Sets how much the brightness of fire is held back.
     *
     * @param {number} scale - The scale, one for full brightness.
     */
    setEmissiveScale(scale) {
        this.emissiveScale = scale;
        this.particles.material.setParameter('uEmissiveScale', scale);
    }

    /**
     * Spawns a particle.
     *
     * @param {ParticlePreset} preset - The kind of particle.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @param {number} [vx] - The x velocity.
     * @param {number} [vy] - The y velocity.
     * @param {number} [vz] - The z velocity.
     * @param {number} [scale] - The size scale.
     * @param {number} [opacity] - The opacity scale.
     * @param {number} [lifeScale] - The lifetime scale.
     */
    spawn(preset, x, y, z, vx = 0, vy = 0, vz = 0, scale = 1, opacity = 1, lifeScale = 1) {
        this.particles.spawn(preset, x, y, z, vx, vy, vz, scale, opacity, lifeScale);
    }

    /**
     * Draws a glowing billboard for this frame only.
     *
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @param {number} z - The z coordinate.
     * @param {number} size - Its size.
     * @param {number} brightness - Its brightness.
     */
    glow(x, y, z, size, brightness) {
        this.particles.spawn(PRESETS.glow, x, y, z, 0, 0, 0, size, brightness);
    }

    /**
     * Lays particles evenly along the path from where an emitter was last time to where it is now.
     *
     * @param {TrailState} state - The emitter's trail state.
     * @param {Vec3} position - Where the emitter is now.
     * @param {number} spacing - How far apart to lay the particles, in meters.
     * @param {(x: number, y: number, z: number, t: number) => void} emit - Called for each particle, with
     * its position and how far along this frame's path it is.
     */
    trail(state, position, spacing, emit) {
        if (!state.hasLast) {
            state.hasLast = true;
            state.lastX = position.x;
            state.lastY = position.y;
            state.lastZ = position.z;
            state.carry = 0;
            return;
        }

        const dx = position.x - state.lastX;
        const dy = position.y - state.lastY;
        const dz = position.z - state.lastZ;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // a jump - a respawn or a teleport - restarts the trail rather than drawing a line across
        if (distance > 400) {
            state.reset();
            this.trail(state, position, spacing, emit);
            return;
        }

        let along = state.carry;
        while (along < distance) {
            const t = along / distance;
            emit(state.lastX + dx * t, state.lastY + dy * t, state.lastZ + dz * t, t);
            along += spacing;
        }
        state.carry = along - distance;
        state.lastX = position.x;
        state.lastY = position.y;
        state.lastZ = position.z;
    }

    /**
     * Lights the surroundings of a detonation for a moment.
     *
     * @param {Vec3} position - Where the light is.
     * @param {number} intensity - How bright it starts.
     * @param {number} range - How far it reaches.
     * @param {number} duration - How long it takes to fade out, in seconds.
     */
    flashLight(position, intensity, range, duration) {
        let light = this.lights[0];
        for (let i = 0; i < this.lights.length; i++) {
            if (this.lights[i].age >= this.lights[i].duration) {
                light = this.lights[i];
                break;
            }
            if (this.lights[i].age / this.lights[i].duration > light.age / light.duration) {
                light = this.lights[i];
            }
        }
        light.age = 0;
        light.duration = duration;
        light.intensity = intensity;
        light.range = range;
        light.entity.enabled = true;
        light.entity.setPosition(position);
        light.entity.light.range = range;
    }

    /**
     * An aircraft or a missile blowing up in the air.
     *
     * @param {Vec3} position - The center of the blast.
     * @param {Vec3} velocity - The velocity of what blew up, which the debris keeps some of.
     * @param {number} scale - How big the blast is.
     */
    airExplosion(position, velocity, scale) {
        const { x, y, z } = position;
        const vx = velocity.x * 0.35;
        const vy = velocity.y * 0.35;
        const vz = velocity.z * 0.35;

        this.spawn(PRESETS.flash, x, y, z, vx, vy, vz, scale);

        const fireballs = Math.round(12 * Math.sqrt(scale) + 6);
        for (let i = 0; i < fireballs; i++) {
            randomDirection(_tmp);
            const speed = (8 + Math.random() * 26) * scale;
            this.spawn(
                PRESETS.fireball,
                x + _tmp.x * 2 * scale,
                y + _tmp.y * 2 * scale,
                z + _tmp.z * 2 * scale,
                vx + _tmp.x * speed,
                vy + _tmp.y * speed,
                vz + _tmp.z * speed,
                scale * (0.7 + Math.random() * 0.6)
            );
        }

        const smokes = Math.round(7 * scale + 3);
        for (let i = 0; i < smokes; i++) {
            randomDirection(_tmp);
            const speed = (4 + Math.random() * 14) * scale;
            this.spawn(
                PRESETS.blastSmoke,
                x + _tmp.x * 3 * scale,
                y + _tmp.y * 3 * scale,
                z + _tmp.z * 3 * scale,
                vx * 0.5 + _tmp.x * speed,
                vy * 0.5 + _tmp.y * speed,
                vz * 0.5 + _tmp.z * speed,
                scale * (0.7 + Math.random() * 0.5)
            );
        }

        const sparks = Math.round(26 * scale);
        for (let i = 0; i < sparks; i++) {
            randomDirection(_tmp);
            const speed = 30 + Math.random() * 70;
            this.spawn(PRESETS.spark, x, y, z, vx + _tmp.x * speed, vy + _tmp.y * speed + 8, vz + _tmp.z * speed);
        }

        const debris = Math.round(8 * scale);
        for (let i = 0; i < debris; i++) {
            randomDirection(_tmp);
            const speed = 15 + Math.random() * 35;
            this.spawn(
                PRESETS.debris,
                x,
                y,
                z,
                vx + _tmp.x * speed,
                vy + _tmp.y * speed + 10,
                vz + _tmp.z * speed,
                0.5 + Math.random() * 0.9
            );
        }

        this.flashLight(position, 260 * scale, 160 * scale, 0.7);
    }

    /**
     * Something blowing up on the ground - a fireball, a column of dirt and dust, and debris thrown
     * up and out.
     *
     * @param {Vec3} position - The center of the blast.
     * @param {number} scale - How big the blast is.
     */
    groundExplosion(position, scale) {
        const { x, y, z } = position;

        this.spawn(PRESETS.flash, x, y + 3 * scale, z, 0, 0, 0, scale * 1.3);

        const fireballs = Math.round(12 * scale + 4);
        for (let i = 0; i < fireballs; i++) {
            randomDirection(_tmp);
            _tmp.y = Math.abs(_tmp.y) * 1.4 + 0.2;
            const speed = (8 + Math.random() * 22) * scale;
            this.spawn(
                PRESETS.fireball,
                x + _tmp.x * 3,
                y + 2 + _tmp.y * 3,
                z + _tmp.z * 3,
                _tmp.x * speed,
                _tmp.y * speed,
                _tmp.z * speed,
                scale * (0.8 + Math.random() * 0.6)
            );
        }

        const dusts = Math.round(9 * scale + 3);
        for (let i = 0; i < dusts; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (6 + Math.random() * 20) * scale;
            this.spawn(
                PRESETS.dust,
                x + Math.cos(angle) * 4,
                y + 2,
                z + Math.sin(angle) * 4,
                Math.cos(angle) * speed,
                (2 + Math.random() * 10) * scale,
                Math.sin(angle) * speed,
                scale * (0.7 + Math.random() * 0.5)
            );
        }

        const smokes = Math.round(5 * scale + 2);
        for (let i = 0; i < smokes; i++) {
            this.spawn(
                PRESETS.blastSmoke,
                x + (Math.random() - 0.5) * 8,
                y + 4,
                z + (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8,
                (6 + Math.random() * 12) * scale,
                (Math.random() - 0.5) * 8,
                scale
            );
        }

        const sparks = Math.round(30 * scale);
        for (let i = 0; i < sparks; i++) {
            randomDirection(_tmp);
            _tmp.y = Math.abs(_tmp.y) + 0.3;
            const speed = 25 + Math.random() * 60;
            this.spawn(PRESETS.spark, x, y + 1, z, _tmp.x * speed, _tmp.y * speed, _tmp.z * speed);
        }

        const debris = Math.round(12 * scale);
        for (let i = 0; i < debris; i++) {
            randomDirection(_tmp);
            _tmp.y = Math.abs(_tmp.y) + 0.5;
            const speed = 12 + Math.random() * 30;
            this.spawn(
                PRESETS.debris,
                x,
                y + 1,
                z,
                _tmp.x * speed,
                _tmp.y * speed,
                _tmp.z * speed,
                0.5 + Math.random() * 1.1
            );
        }

        _tmp.set(x, y + 6, z);
        this.flashLight(_tmp, 320 * scale, 200 * scale, 0.9);
    }

    /**
     * A small puff for a missile that ran out of fuel and self destructed, or hit a flare.
     *
     * @param {Vec3} position - Where it went off.
     */
    smallExplosion(position) {
        const { x, y, z } = position;
        this.spawn(PRESETS.flash, x, y, z, 0, 0, 0, 0.4);
        for (let i = 0; i < 5; i++) {
            randomDirection(_tmp);
            this.spawn(PRESETS.fireball, x, y, z, _tmp.x * 12, _tmp.y * 12, _tmp.z * 12, 0.35);
            this.spawn(PRESETS.blastSmoke, x, y, z, _tmp.x * 5, _tmp.y * 5, _tmp.z * 5, 0.3);
        }
        for (let i = 0; i < 10; i++) {
            randomDirection(_tmp);
            const speed = 20 + Math.random() * 40;
            this.spawn(PRESETS.spark, x, y, z, _tmp.x * speed, _tmp.y * speed, _tmp.z * speed);
        }
        this.flashLight(position, 60, 60, 0.4);
    }

    /**
     * Creates the afterburner flame for a nozzle.
     *
     * @param {number} radius - The radius at the nozzle.
     * @param {number} length - The length of the flame at full throttle.
     * @returns {Entity} The flame, pointing along its +z axis. Drive it with
     * {@link Effects#setFlame}.
     */
    createFlame(radius, length) {
        const device = this.app.graphicsDevice;
        const segments = 16;
        const rings = 8;
        const positions = [];
        const uvs = [];
        const indices = [];
        for (let r = 0; r <= rings; r++) {
            const t = r / rings;

            // a tight cone, barely swelling past the nozzle before it necks down to a point
            const ringRadius = radius * (1 + Math.sin(t * Math.PI) * 0.08) * (1 - t * 0.9);
            for (let s = 0; s <= segments; s++) {
                const angle = (s / segments) * Math.PI * 2;
                positions.push(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, t * length);
                uvs.push(s / segments, t);
            }
        }
        for (let r = 0; r < rings; r++) {
            for (let s = 0; s < segments; s++) {
                const a = r * (segments + 1) + s;
                const b = a + segments + 1;
                indices.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
        const mesh = new Mesh(device);
        mesh.setPositions(positions);
        mesh.setUvs(0, uvs);
        mesh.setIndices(indices);
        mesh.update(PRIMITIVE_TRIANGLES);

        // the length, the time, the brightness, and a phase so that no two flames flicker together
        const params = new Float32Array([1, 0, 1, Math.random() * 10]);
        const meshInstance = new MeshInstance(mesh, this.flameMaterial);
        meshInstance.setParameter('uFlame', params);

        const entity = new Entity('Flame');
        entity.addComponent('render', {
            meshInstances: [meshInstance],
            castShadows: false,
            receiveShadows: false
        });
        this.flames.set(entity, params);
        return entity;
    }

    /**
     * Drives a flame.
     *
     * @param {Entity} flame - The flame created by {@link Effects#createFlame}.
     * @param {number} length - Its length, as a fraction of full throttle.
     * @param {number} intensity - Its brightness.
     */
    setFlame(flame, length, intensity) {
        const meshInstance = flame.render.meshInstances[0];
        const params = this.flames.get(flame);
        params[0] = length;
        params[1] = this.time + params[3];
        params[2] = intensity * this.emissiveScale;
        meshInstance.setParameter('uFlame', params);
        meshInstance.visible = intensity > 0.01;
    }

    /**
     * Advances everything.
     *
     * @param {number} dt - The time step.
     * @param {CameraComponent} camera - The camera rendering the frame.
     */
    update(dt, camera) {
        this.time += dt;

        for (let i = 0; i < this.lights.length; i++) {
            const light = this.lights[i];
            if (!light.entity.enabled) {
                continue;
            }
            light.age += dt;
            const t = light.age / light.duration;
            if (t >= 1) {
                light.entity.enabled = false;
                continue;
            }
            light.entity.light.intensity = light.intensity * (1 - t) * (1 - t);
        }

        const cameraEntity = camera.entity;
        const pixelSize = (2 * Math.tan(camera.fov * 0.5 * math.DEG_TO_RAD)) / this.app.graphicsDevice.height;
        this.particles.update(dt, cameraEntity.getPosition(), cameraEntity.forward);
        this.ribbons.update(this.time, cameraEntity.getPosition(), this.particles.wind, pixelSize);
        this.trails.update(this.time, cameraEntity.getPosition(), this.particles.wind, pixelSize);
        this.wakes.update(this.time);
    }
}
