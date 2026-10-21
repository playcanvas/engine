// fraction of the far clip the fade must end within
const FAR_FRACTION = '0.9';

// cell size in CSS pixels below which lines thin with their cells, so distant lines fade
const LINE_FADE_CELL = '64.0';

// cell size in CSS pixels where a level starts to fade in, and the levels drawn above it
const LEVEL_FADE_CELL = '4.0';
const LEVELS_ABOVE = 2;

export const vertexGLSL = /* glsl */`
    attribute vec3 vertex_position;

    uniform mat4 matrix_model;
    uniform mat4 matrix_view;
    uniform mat4 matrix_viewProjection;
    uniform vec3 view_position;
    uniform vec4 camera_params;

    uniform vec3 uAxisU;
    uniform vec3 uAxisV;
    uniform float uInfinite;
    uniform vec2 uFade;
    uniform float uDepthOffset;

    varying vec2 vGridPos;
    varying vec3 vWorldPos;
    varying vec4 vClipPos;
    varying vec3 vToEye;
    varying vec3 vNormal;

    void main(void) {

        // the node's scale sizes a fixed grid, never its cells
        vec3 origin = matrix_model[3].xyz;
        vec3 axisU = mat3(matrix_model) * uAxisU;
        vec3 axisV = mat3(matrix_model) * uAxisV;
        vec3 u = normalize(axisU);
        vec3 v = normalize(axisV);

        // an infinite grid follows the camera and spans the fade distance
        float reach = 2.0 * min(uFade.y, camera_params.y * ${FAR_FRACTION});
        vec2 center = vec2(dot(view_position - origin, u), dot(view_position - origin, v)) * uInfinite;
        vGridPos = center + vertex_position.xz * mix(vec2(length(axisU), length(axisV)), vec2(reach), uInfinite);
        vWorldPos = origin + u * vGridPos.x + v * vGridPos.y;

        // offset along the view ray, so only depth changes
        vec3 back = vec3(matrix_view[0][2], matrix_view[1][2], matrix_view[2][2]);
        vec3 toEye = view_position - vWorldPos;
        if (camera_params.w > 0.5) {
            toEye = back * dot(toEye, back);
        }
        gl_Position = matrix_viewProjection * vec4(vWorldPos + toEye * uDepthOffset, 1.0);
        vClipPos = gl_Position;
        vToEye = toEye;
        vNormal = cross(u, v);
    }
`;

export const fragmentGLSL = /* glsl */`
    #include "gammaPS"

    uniform vec3 view_position;
    uniform vec4 camera_params;

    uniform vec2 uFade;
    uniform float uSpacing;
    uniform float uSubdivisions;
    uniform vec3 uThickness;
    uniform float uPixelRatio;
    uniform float uShowAxes;
    uniform vec4 uColorU;
    uniform vec4 uColorV;
    uniform vec4 uMajorColor;
    uniform vec4 uMinorColor;

    #ifdef GRID_CONTRAST
        uniform sampler2D uSceneColorMap;
    #endif

    #ifdef GRID_DEPTH_DITHER
        uniform sampler2D blueNoiseTex32;
    #endif

    varying vec2 vGridPos;
    varying vec3 vWorldPos;
    varying vec4 vClipPos;
    varying vec3 vToEye;
    varying vec3 vNormal;

    // https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8#1e7c, with lines in pixels
    float pristineGrid(vec2 uv, vec2 uvDeriv, float pixels, vec2 fade) {
        vec2 targetWidth = min(pixels * uvDeriv, vec2(min(pixels / (${LINE_FADE_CELL} * uPixelRatio), 0.5)));
        vec2 drawWidth = clamp(targetWidth, uvDeriv, vec2(0.5));
        vec2 lineAA = uvDeriv * 1.5;
        vec2 gridUV = 1.0 - abs(fract(uv) * 2.0 - 1.0);
        vec2 grid2 = smoothstep(drawWidth + lineAA, drawWidth - lineAA, gridUV);
        grid2 *= clamp(targetWidth / drawWidth, 0.0, 1.0);
        grid2 = mix(grid2, targetWidth, clamp(uvDeriv * 2.0 - 1.0, 0.0, 1.0));
        grid2 *= fade;
        return mix(grid2.x, 1.0, grid2.y);
    }

    // drops the origin line when the axes draw it
    vec2 offAxis(vec2 uv) {
        return uShowAxes > 0.5 ? step(0.5, abs(uv)) : vec2(1.0);
    }

    void main(void) {
        vec2 pos = vGridPos / uSpacing;
        vec2 ddx = dFdx(pos);
        vec2 ddy = dFdy(pos);
        vec2 uvDeriv = vec2(length(vec2(ddx.x, ddy.x)), length(vec2(ddx.y, ddy.y)));
        float epsilon = 1.0 / 255.0;

        // the level fading in, by cell size on screen; one fixed level without subdivisions
        float lod = uSubdivisions > 1.0 ?
            log(${LEVEL_FADE_CELL} * uPixelRatio * max(uvDeriv.x, uvDeriv.y)) / log(uSubdivisions) :
            -1.0;
        float finest = ceil(lod);

        // coarsest level first; the finest fades in and the coarser turn major
        vec4 color = uMinorColor;
        float line = 0.0;
        for (int i = ${LEVELS_ABOVE}; i >= 0; i--) {
            float k = finest + float(i);
            float scale = pow(uSubdivisions, -k);
            float c = k - lod;
            float major = clamp(c - 1.0, 0.0, 1.0);
            float l = pristineGrid(pos * scale, uvDeriv * scale, mix(uThickness.y, uThickness.x, major), offAxis(pos * scale));
            l *= clamp(c, 0.0, 1.0);
            if (l > epsilon) {
                color = mix(uMinorColor, uMajorColor, major);
                line = l;
                break;
            }
        }

        // axis lines, from the coarsest level
        float topScale = pow(uSubdivisions, -(finest + ${LEVELS_ABOVE}.0));
        vec2 top = pos * topScale;
        vec2 topDeriv = uvDeriv * topScale;
        float lineU = abs(top.y) < 0.5 ? pristineGrid(top, topDeriv, uThickness.z, vec2(0.0, 1.0)) : 0.0;
        float lineV = abs(top.x) < 0.5 ? pristineGrid(top, topDeriv, uThickness.z, vec2(1.0, 0.0)) : 0.0;
        float axis = max(lineU, lineV) * uShowAxes;
        if (axis > epsilon && axis >= line) {
            color = lineU >= lineV ? uColorU : uColorV;
            line = axis;
        }
        #ifdef GRID_CONTRAST
            else {
                // black over light, white over dark
                vec3 under = texture2DLod(uSceneColorMap, (vClipPos.xy / vClipPos.w) * 0.5 + 0.5, 0.0).rgb;
                color.rgb = vec3(1.0 - smoothstep(0.4, 0.6, dot(under, vec3(0.2126, 0.7152, 0.0722))));
            }
        #endif

        // distance fade
        float fadeEnd = min(uFade.y, camera_params.y * ${FAR_FRACTION});
        float fadeStart = min(uFade.x, fadeEnd);
        float f = clamp((length(vWorldPos - view_position) - fadeStart) / max(fadeEnd - fadeStart, 1e-5), 0.0, 1.0);

        // grazing angle fade
        float grazing = 1.0 - pow(1.0 - abs(dot(normalize(vToEye), normalize(vNormal))), 3.0);
        float coverage = line * (1.0 - f * f * (3.0 - 2.0 * f)) * grazing;
        float alpha = coverage * color.a;
        if (alpha <= epsilon) {
            discard;
        }

        #ifdef GRID_DEPTH
            // write depth where coverage beats the noise, or half
            #ifdef GRID_DEPTH_DITHER
                float threshold = texture2DLod(blueNoiseTex32, fract(gl_FragCoord.xy / 32.0), 0.0).y;
            #else
                float threshold = 0.5;
            #endif
            if (coverage < threshold) {
                discard;
            }
            gl_FragColor = vec4(0.0);
        #else
            gl_FragColor = vec4(gammaCorrectOutput(decodeGamma(color.rgb)), alpha);
        #endif
    }
`;

export const vertexWGSL = /* wgsl */`
    attribute vertex_position: vec3f;

    uniform matrix_model: mat4x4f;
    uniform matrix_view: mat4x4f;
    uniform matrix_viewProjection: mat4x4f;
    uniform view_position: vec3f;
    uniform camera_params: vec4f;

    uniform uAxisU: vec3f;
    uniform uAxisV: vec3f;
    uniform uInfinite: f32;
    uniform uFade: vec2f;
    uniform uDepthOffset: f32;

    varying vGridPos: vec2f;
    varying vWorldPos: vec3f;
    varying vClipPos: vec4f;
    varying vToEye: vec3f;
    varying vNormal: vec3f;

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;

        // the node's scale sizes a fixed grid, never its cells
        let model = uniform.matrix_model;
        let origin = model[3].xyz;
        let axisU = (model * vec4f(uniform.uAxisU, 0.0)).xyz;
        let axisV = (model * vec4f(uniform.uAxisV, 0.0)).xyz;
        let u = normalize(axisU);
        let v = normalize(axisV);

        // an infinite grid follows the camera and spans the fade distance
        let reach = 2.0 * min(uniform.uFade.y, uniform.camera_params.y * ${FAR_FRACTION});
        let center = vec2f(dot(uniform.view_position - origin, u), dot(uniform.view_position - origin, v)) * uniform.uInfinite;
        let gridPos = center + input.vertex_position.xz * mix(vec2f(length(axisU), length(axisV)), vec2f(reach), uniform.uInfinite);
        let worldPos = origin + u * gridPos.x + v * gridPos.y;
        output.vGridPos = gridPos;
        output.vWorldPos = worldPos;

        // offset along the view ray, so only depth changes
        let view = uniform.matrix_view;
        let back = vec3f(view[0][2], view[1][2], view[2][2]);
        var toEye = uniform.view_position - worldPos;
        if (uniform.camera_params.w > 0.5) {
            toEye = back * dot(toEye, back);
        }
        output.position = uniform.matrix_viewProjection * vec4f(worldPos + toEye * uniform.uDepthOffset, 1.0);
        output.vClipPos = output.position;
        output.vToEye = toEye;
        output.vNormal = cross(u, v);
        return output;
    }
`;

export const fragmentWGSL = /* wgsl */`
    #include "gammaPS"

    uniform view_position: vec3f;
    uniform camera_params: vec4f;

    uniform uFade: vec2f;
    uniform uSpacing: f32;
    uniform uSubdivisions: f32;
    uniform uThickness: vec3f;
    uniform uPixelRatio: f32;
    uniform uShowAxes: f32;
    uniform uColorU: vec4f;
    uniform uColorV: vec4f;
    uniform uMajorColor: vec4f;
    uniform uMinorColor: vec4f;

    #ifdef GRID_CONTRAST
        var uSceneColorMap: texture_2d<f32>;
        var uSceneColorMapSampler: sampler;
    #endif

    #ifdef GRID_DEPTH_DITHER
        var blueNoiseTex32: texture_2d<f32>;
        var blueNoiseTex32Sampler: sampler;
    #endif

    varying vGridPos: vec2f;
    varying vWorldPos: vec3f;
    varying vClipPos: vec4f;
    varying vToEye: vec3f;
    varying vNormal: vec3f;

    // https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8#1e7c, with lines in pixels
    fn pristineGrid(uv: vec2f, uvDeriv: vec2f, pixels: f32, fade: vec2f) -> f32 {
        let targetWidth = min(pixels * uvDeriv, vec2f(min(pixels / (${LINE_FADE_CELL} * uniform.uPixelRatio), 0.5)));
        let drawWidth = clamp(targetWidth, uvDeriv, vec2f(0.5));
        let lineAA = uvDeriv * 1.5;
        let gridUV = 1.0 - abs(fract(uv) * 2.0 - 1.0);
        var grid2 = smoothstep(drawWidth + lineAA, drawWidth - lineAA, gridUV);
        grid2 *= clamp(targetWidth / drawWidth, vec2f(0.0), vec2f(1.0));
        grid2 = mix(grid2, targetWidth, clamp(uvDeriv * 2.0 - 1.0, vec2f(0.0), vec2f(1.0)));
        grid2 *= fade;
        return mix(grid2.x, 1.0, grid2.y);
    }

    // drops the origin line when the axes draw it
    fn offAxis(uv: vec2f) -> vec2f {
        return select(vec2f(1.0), step(vec2f(0.5), abs(uv)), uniform.uShowAxes > 0.5);
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        // derivatives need uniform control flow
        let pos = input.vGridPos / uniform.uSpacing;
        let ddx = dpdx(pos);
        let ddy = dpdy(pos);
        let uvDeriv = vec2f(length(vec2f(ddx.x, ddy.x)), length(vec2f(ddx.y, ddy.y)));
        let epsilon = 1.0 / 255.0;

        // the level fading in, by cell size on screen; one fixed level without subdivisions
        let lod = select(
            -1.0,
            log(${LEVEL_FADE_CELL} * uniform.uPixelRatio * max(uvDeriv.x, uvDeriv.y)) / log(uniform.uSubdivisions),
            uniform.uSubdivisions > 1.0
        );
        let finest = ceil(lod);

        // coarsest level first; the finest fades in and the coarser turn major
        var color = uniform.uMinorColor;
        var line = 0.0;
        for (var i: i32 = ${LEVELS_ABOVE}; i >= 0; i--) {
            let k = finest + f32(i);
            let scale = pow(uniform.uSubdivisions, -k);
            let c = k - lod;
            let major = clamp(c - 1.0, 0.0, 1.0);
            let thickness = mix(uniform.uThickness.y, uniform.uThickness.x, major);
            let l = pristineGrid(pos * scale, uvDeriv * scale, thickness, offAxis(pos * scale)) * clamp(c, 0.0, 1.0);
            if (l > epsilon) {
                color = mix(uniform.uMinorColor, uniform.uMajorColor, major);
                line = l;
                break;
            }
        }

        // axis lines, from the coarsest level
        let topScale = pow(uniform.uSubdivisions, -(finest + ${LEVELS_ABOVE}.0));
        let top = pos * topScale;
        let topDeriv = uvDeriv * topScale;
        let lineU = select(0.0, pristineGrid(top, topDeriv, uniform.uThickness.z, vec2f(0.0, 1.0)), abs(top.y) < 0.5);
        let lineV = select(0.0, pristineGrid(top, topDeriv, uniform.uThickness.z, vec2f(1.0, 0.0)), abs(top.x) < 0.5);
        let axis = max(lineU, lineV) * uniform.uShowAxes;
        if (axis > epsilon && axis >= line) {
            color = select(uniform.uColorV, uniform.uColorU, lineU >= lineV);
            line = axis;
        }
        #ifdef GRID_CONTRAST
            else {
                // black over light, white over dark
                var uv = (input.vClipPos.xy / input.vClipPos.w) * 0.5 + vec2f(0.5);
                uv.y = 1.0 - uv.y;
                let under = textureSampleLevel(uSceneColorMap, uSceneColorMapSampler, uv, 0.0).rgb;
                color = vec4f(vec3f(1.0 - smoothstep(0.4, 0.6, dot(under, vec3f(0.2126, 0.7152, 0.0722)))), color.a);
            }
        #endif

        // distance fade
        let fadeEnd = min(uniform.uFade.y, uniform.camera_params.y * ${FAR_FRACTION});
        let fadeStart = min(uniform.uFade.x, fadeEnd);
        let f = clamp((length(input.vWorldPos - uniform.view_position) - fadeStart) / max(fadeEnd - fadeStart, 1e-5), 0.0, 1.0);

        // grazing angle fade
        let grazing = 1.0 - pow(1.0 - abs(dot(normalize(input.vToEye), normalize(input.vNormal))), 3.0);
        let coverage = line * (1.0 - f * f * (3.0 - 2.0 * f)) * grazing;
        let alpha = coverage * color.a;
        if (alpha <= epsilon) {
            discard;
        }

        #ifdef GRID_DEPTH
            // write depth where coverage beats the noise, or half
            #ifdef GRID_DEPTH_DITHER
                let threshold = textureSampleLevel(blueNoiseTex32, blueNoiseTex32Sampler, fract(pcPosition.xy / 32.0), 0.0).y;
            #else
                let threshold = 0.5;
            #endif
            if (coverage < threshold) {
                discard;
            }
            output.color = vec4f(0.0);
        #else
            output.color = vec4f(gammaCorrectOutput(decodeGamma3(color.rgb)), alpha);
        #endif
        return output;
    }
`;
