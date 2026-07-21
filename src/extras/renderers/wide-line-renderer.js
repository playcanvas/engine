import { BUFFER_DYNAMIC, CULLFACE_NONE, PRIMITIVE_TRIANGLES, SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15, SEMANTIC_POSITION, TYPE_FLOAT32 } from '../../platform/graphics/constants.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Mesh } from '../../scene/mesh.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { ShaderMaterial } from '../../scene/materials/shader-material.js';

import { WideLine } from './wide-line.js';

/**
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { Layer } from '../../scene/layer.js'
 */

/** Line widths are measured in screen pixels. */
const LINEWIDTH_SCREEN = 0;

/** Line widths are measured in world units. */
const LINEWIDTH_WORLD = 1;

const FLOATS_PER_INSTANCE = 30;
const ROUND_SEGMENTS = 16;

const vertexGLSL = /* glsl */ `
    attribute vec3 vertex_position;
    attribute vec4 instance_prevWidth;
    attribute vec4 instance_startWidth;
    attribute vec4 instance_endDistance;
    attribute vec4 instance_nextDistance;
    attribute vec3 instance_startColor;
    attribute vec3 instance_endColor;
    attribute vec4 instance_style;
    attribute vec4 instance_dashFlags;

    uniform mat4 matrix_viewProjection;
    uniform vec4 uScreenSize;
    #ifdef WIDE_LINE_WORLD_SPACE_WIDTH
        uniform mat4 matrix_projection;
    #endif

    varying vec3 vColor;
    varying vec4 vDash;
    varying vec3 vLineData;
    varying float vDistance;

    vec2 safeNormalize(vec2 value, vec2 fallbackValue) {
        float lengthValue = length(value);
        return lengthValue > 0.00001 ? value / lengthValue : fallbackValue;
    }

    vec2 perpendicular(vec2 value) {
        return vec2(-value.y, value.x);
    }

    vec2 toScreen(vec4 clipPosition) {
        float w = abs(clipPosition.w) > 0.00001 ? clipPosition.w : 0.00001;
        return clipPosition.xy / w * uScreenSize.xy * 0.5;
    }

    vec4 offsetClip(vec4 clipPosition, vec2 pixelOffset) {
        clipPosition.xy += pixelOffset * (2.0 * uScreenSize.zw) * clipPosition.w;
        return clipPosition;
    }

    float resolveHalfWidth(float width, vec4 clipPosition) {
        #ifdef WIDE_LINE_WORLD_SPACE_WIDTH
            float pixelsPerWorldUnit = abs(matrix_projection[1][1]) * uScreenSize.y * 0.5 /
                max(abs(clipPosition.w), 0.00001);
            return width * 0.5 * pixelsPerWorldUnit;
        #else
            return width * 0.5;
        #endif
    }

    vec2 miterOffset(vec2 firstDirection, vec2 secondDirection, float side, float halfWidth) {
        vec2 secondNormal = perpendicular(secondDirection);
        vec2 miter = safeNormalize(perpendicular(firstDirection) + secondNormal, secondNormal);
        float scale = halfWidth / max(dot(miter, secondNormal), 0.25);
        return miter * side * min(scale, halfWidth * 4.0);
    }

    void main(void) {
        vec3 prev = instance_prevWidth.xyz;
        vec3 start = instance_startWidth.xyz;
        vec3 end = instance_endDistance.xyz;
        vec3 next = instance_nextDistance.xyz;

        float startDistance = instance_endDistance.w;
        float endDistance = instance_nextDistance.w;

        vec4 prevClip = matrix_viewProjection * vec4(prev, 1.0);
        vec4 startClip = matrix_viewProjection * vec4(start, 1.0);
        vec4 endClip = matrix_viewProjection * vec4(end, 1.0);
        vec4 nextClip = matrix_viewProjection * vec4(next, 1.0);

        float startHalfWidth = resolveHalfWidth(instance_prevWidth.w, startClip);
        float endHalfWidth = resolveHalfWidth(instance_startWidth.w, endClip);

        vec2 startScreen = toScreen(startClip);
        vec2 endScreen = toScreen(endClip);
        vec2 currentDirection = safeNormalize(endScreen - startScreen, vec2(1.0, 0.0));
        vec2 previousDirection = safeNormalize(startScreen - toScreen(prevClip), currentDirection);
        vec2 nextDirection = safeNormalize(toScreen(nextClip) - endScreen, currentDirection);
        vec2 currentNormal = perpendicular(currentDirection);
        vec2 previousNormal = perpendicular(previousDirection);

        float joinStyle = instance_style.x;
        float capStyle = instance_style.y;
        uint flags = uint(instance_dashFlags.y + 0.5);
        bool startConnected = (flags & 1u) != 0u;
        bool endConnected = (flags & 2u) != 0u;

        float kind = vertex_position.z;
        vec4 clipPosition;
        vLineData = vec3(0.0, startHalfWidth, 0.0);

        if (kind < 0.5) {
            float along = vertex_position.x;
            float side = vertex_position.y;
            bool atStart = along < 0.5;
            float halfWidth = atStart ? startHalfWidth : endHalfWidth;
            vec2 offset;

            if (atStart) {
                if (startConnected && joinStyle < 0.5) {
                    offset = miterOffset(previousDirection, currentDirection, side, halfWidth);
                } else {
                    offset = currentNormal * side * halfWidth;
                    if (!startConnected && capStyle > 0.5 && capStyle < 1.5) {
                        offset -= currentDirection * halfWidth;
                    }
                }
                clipPosition = offsetClip(startClip, offset);
            } else {
                if (endConnected && joinStyle < 0.5) {
                    offset = miterOffset(currentDirection, nextDirection, side, halfWidth);
                } else {
                    offset = currentNormal * side * halfWidth;
                    if (!endConnected && capStyle > 0.5 && capStyle < 1.5) {
                        offset += currentDirection * halfWidth;
                    }
                }
                clipPosition = offsetClip(endClip, offset);
            }

            vColor = mix(instance_startColor, instance_endColor, along);
            vDistance = mix(startDistance, endDistance, along);
            vLineData = vec3(side, mix(startHalfWidth, endHalfWidth, along), 1.0);
        } else if (kind < 1.5) {
            bool visible = (startConnected && joinStyle > 1.5) || (!startConnected && capStyle > 1.5);
            float scale = visible ? startHalfWidth : 0.0;
            vec2 offset = (currentDirection * vertex_position.x + currentNormal * vertex_position.y) * scale;
            clipPosition = offsetClip(startClip, offset);
            vColor = instance_startColor;
            vDistance = startDistance;
        } else if (kind < 2.5) {
            bool visible = !endConnected && capStyle > 1.5;
            float scale = visible ? endHalfWidth : 0.0;
            vec2 offset = (currentDirection * vertex_position.x + currentNormal * vertex_position.y) * scale;
            clipPosition = offsetClip(endClip, offset);
            vColor = instance_endColor;
            vDistance = endDistance;
        } else {
            bool visible = startConnected && joinStyle > 0.5 && joinStyle < 1.5;
            float scale = visible ? startHalfWidth : 0.0;
            vec2 offset = vec2(0.0);
            if (kind > 3.5 && kind < 4.5) {
                offset = previousNormal * vertex_position.y * scale;
            } else if (kind > 4.5) {
                offset = currentNormal * vertex_position.y * scale;
            }
            clipPosition = offsetClip(startClip, offset);
            vColor = instance_startColor;
            vDistance = startDistance;
        }

        vDash = vec4(instance_style.z, instance_style.w, instance_dashFlags.x, capStyle);
        gl_Position = clipPosition;
    }
`;

const fragmentGLSL = /* glsl */ `
    varying vec3 vColor;
    varying vec4 vDash;
    varying vec3 vLineData;
    varying float vDistance;

    void main(void) {
        float worldPerPixel = length(vec2(dFdx(vDistance), dFdy(vDistance)));

        if (vDash.x > 0.0 && vDash.y > 0.0) {
            float period = vDash.x + vDash.y;
            float phase = mod(vDistance + vDash.z, period);
            if (phase < 0.0) {
                phase += period;
            }
            if (phase > vDash.x) {
                if (vDash.w > 1.5 && vLineData.z > 0.5) {
                    float along = min(phase - vDash.x, period - phase) / max(worldPerPixel, 0.00001);
                    float across = abs(vLineData.x) * vLineData.y;
                    if (length(vec2(along, across)) > vLineData.y) {
                        discard;
                    }
                } else {
                    discard;
                }
            }
        }

        gl_FragColor = vec4(vColor, 1.0);
    }
`;

const vertexWGSL = /* wgsl */ `
    attribute vertex_position: vec3f;
    attribute instance_prevWidth: vec4f;
    attribute instance_startWidth: vec4f;
    attribute instance_endDistance: vec4f;
    attribute instance_nextDistance: vec4f;
    attribute instance_startColor: vec3f;
    attribute instance_endColor: vec3f;
    attribute instance_style: vec4f;
    attribute instance_dashFlags: vec4f;

    uniform matrix_viewProjection: mat4x4f;
    uniform uScreenSize: vec4f;
    #ifdef WIDE_LINE_WORLD_SPACE_WIDTH
        uniform matrix_projection: mat4x4f;
    #endif

    varying vColor: vec3f;
    varying vDash: vec4f;
    varying vLineData: vec3f;
    varying vDistance: f32;

    fn safeNormalize(value: vec2f, fallbackValue: vec2f) -> vec2f {
        let lengthValue = length(value);
        return select(fallbackValue, value / lengthValue, lengthValue > 0.00001);
    }

    fn perpendicular(value: vec2f) -> vec2f {
        return vec2f(-value.y, value.x);
    }

    fn toScreen(clipPosition: vec4f) -> vec2f {
        let w = select(0.00001, clipPosition.w, abs(clipPosition.w) > 0.00001);
        return clipPosition.xy / w * uniform.uScreenSize.xy * 0.5;
    }

    fn offsetClip(position: vec4f, pixelOffset: vec2f) -> vec4f {
        var clipPosition = position;
        clipPosition.x += pixelOffset.x * (2.0 * uniform.uScreenSize.z) * clipPosition.w;
        clipPosition.y += pixelOffset.y * (2.0 * uniform.uScreenSize.w) * clipPosition.w;
        return clipPosition;
    }

    fn resolveHalfWidth(width: f32, clipPosition: vec4f) -> f32 {
        #ifdef WIDE_LINE_WORLD_SPACE_WIDTH
            let pixelsPerWorldUnit = abs(uniform.matrix_projection[1][1]) * uniform.uScreenSize.y * 0.5 /
                max(abs(clipPosition.w), 0.00001);
            return width * 0.5 * pixelsPerWorldUnit;
        #else
            return width * 0.5;
        #endif
    }

    fn miterOffset(firstDirection: vec2f, secondDirection: vec2f, side: f32, halfWidth: f32) -> vec2f {
        let secondNormal = perpendicular(secondDirection);
        let miter = safeNormalize(perpendicular(firstDirection) + secondNormal, secondNormal);
        let scale = halfWidth / max(dot(miter, secondNormal), 0.25);
        return miter * side * min(scale, halfWidth * 4.0);
    }

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;

        let prev = input.instance_prevWidth.xyz;
        let start = input.instance_startWidth.xyz;
        let end = input.instance_endDistance.xyz;
        let next = input.instance_nextDistance.xyz;

        let startDistance = input.instance_endDistance.w;
        let endDistance = input.instance_nextDistance.w;

        let prevClip = uniform.matrix_viewProjection * vec4f(prev, 1.0);
        let startClip = uniform.matrix_viewProjection * vec4f(start, 1.0);
        let endClip = uniform.matrix_viewProjection * vec4f(end, 1.0);
        let nextClip = uniform.matrix_viewProjection * vec4f(next, 1.0);

        let startHalfWidth = resolveHalfWidth(input.instance_prevWidth.w, startClip);
        let endHalfWidth = resolveHalfWidth(input.instance_startWidth.w, endClip);

        let startScreen = toScreen(startClip);
        let endScreen = toScreen(endClip);
        let currentDirection = safeNormalize(endScreen - startScreen, vec2f(1.0, 0.0));
        let previousDirection = safeNormalize(startScreen - toScreen(prevClip), currentDirection);
        let nextDirection = safeNormalize(toScreen(nextClip) - endScreen, currentDirection);
        let currentNormal = perpendicular(currentDirection);
        let previousNormal = perpendicular(previousDirection);

        let joinStyle = input.instance_style.x;
        let capStyle = input.instance_style.y;
        let flags = u32(input.instance_dashFlags.y + 0.5);
        let startConnected = (flags & 1u) != 0u;
        let endConnected = (flags & 2u) != 0u;

        let kind = input.vertex_position.z;
        var clipPosition: vec4f;
        output.vLineData = vec3f(0.0, startHalfWidth, 0.0);

        if (kind < 0.5) {
            let along = input.vertex_position.x;
            let side = input.vertex_position.y;
            let atStart = along < 0.5;
            let halfWidth = select(endHalfWidth, startHalfWidth, atStart);
            var offset: vec2f;

            if (atStart) {
                if (startConnected && joinStyle < 0.5) {
                    offset = miterOffset(previousDirection, currentDirection, side, halfWidth);
                } else {
                    offset = currentNormal * side * halfWidth;
                    if (!startConnected && capStyle > 0.5 && capStyle < 1.5) {
                        offset -= currentDirection * halfWidth;
                    }
                }
                clipPosition = offsetClip(startClip, offset);
            } else {
                if (endConnected && joinStyle < 0.5) {
                    offset = miterOffset(currentDirection, nextDirection, side, halfWidth);
                } else {
                    offset = currentNormal * side * halfWidth;
                    if (!endConnected && capStyle > 0.5 && capStyle < 1.5) {
                        offset += currentDirection * halfWidth;
                    }
                }
                clipPosition = offsetClip(endClip, offset);
            }

            output.vColor = mix(input.instance_startColor, input.instance_endColor, along);
            output.vDistance = mix(startDistance, endDistance, along);
            output.vLineData = vec3f(side, mix(startHalfWidth, endHalfWidth, along), 1.0);
        } else if (kind < 1.5) {
            let visible = (startConnected && joinStyle > 1.5) || (!startConnected && capStyle > 1.5);
            let scale = select(0.0, startHalfWidth, visible);
            let offset = (currentDirection * input.vertex_position.x + currentNormal * input.vertex_position.y) * scale;
            clipPosition = offsetClip(startClip, offset);
            output.vColor = input.instance_startColor;
            output.vDistance = startDistance;
        } else if (kind < 2.5) {
            let visible = !endConnected && capStyle > 1.5;
            let scale = select(0.0, endHalfWidth, visible);
            let offset = (currentDirection * input.vertex_position.x + currentNormal * input.vertex_position.y) * scale;
            clipPosition = offsetClip(endClip, offset);
            output.vColor = input.instance_endColor;
            output.vDistance = endDistance;
        } else {
            let visible = startConnected && joinStyle > 0.5 && joinStyle < 1.5;
            let scale = select(0.0, startHalfWidth, visible);
            var offset = vec2f(0.0);
            if (kind > 3.5 && kind < 4.5) {
                offset = previousNormal * input.vertex_position.y * scale;
            } else if (kind > 4.5) {
                offset = currentNormal * input.vertex_position.y * scale;
            }
            clipPosition = offsetClip(startClip, offset);
            output.vColor = input.instance_startColor;
            output.vDistance = startDistance;
        }

        output.vDash = vec4f(input.instance_style.z, input.instance_style.w, input.instance_dashFlags.x, capStyle);
        output.position = clipPosition;
        return output;
    }
`;

const fragmentWGSL = /* wgsl */ `
    varying vColor: vec3f;
    varying vDash: vec4f;
    varying vLineData: vec3f;
    varying vDistance: f32;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        let worldPerPixel = length(vec2f(dpdx(input.vDistance), dpdy(input.vDistance)));

        if (input.vDash.x > 0.0 && input.vDash.y > 0.0) {
            let period = input.vDash.x + input.vDash.y;
            var phase = input.vDistance + input.vDash.z;
            phase = phase - floor(phase / period) * period;
            if (phase > input.vDash.x) {
                if (input.vDash.w > 1.5 && input.vLineData.z > 0.5) {
                    let along = min(phase - input.vDash.x, period - phase) / max(worldPerPixel, 0.00001);
                    let across = abs(input.vLineData.x) * input.vLineData.y;
                    if (length(vec2f(along, across)) > input.vLineData.y) {
                        discard;
                        return output;
                    }
                } else {
                    discard;
                    return output;
                }
            }
        }

        output.color = vec4f(input.vColor, 1.0);
        return output;
    }
`;

const createTemplateMesh = (device) => {
    const positions = [
        0, -1, 0,
        0, 1, 0,
        1, -1, 0,
        1, 1, 0
    ];
    const indices = [0, 2, 1, 1, 2, 3];

    const addDisk = (kind) => {
        const center = positions.length / 3;
        positions.push(0, 0, kind);
        for (let i = 0; i <= ROUND_SEGMENTS; i++) {
            const angle = i / ROUND_SEGMENTS * Math.PI * 2;
            positions.push(Math.cos(angle), Math.sin(angle), kind);
        }
        for (let i = 0; i < ROUND_SEGMENTS; i++) {
            indices.push(center, center + i + 1, center + i + 2);
        }
    };

    addDisk(1);
    addDisk(2);

    for (let side = -1; side <= 1; side += 2) {
        const base = positions.length / 3;
        positions.push(
            0, 0, 3,
            0, side, 4,
            0, side, 5
        );
        indices.push(base, base + 1, base + 2);
    }

    const mesh = new Mesh(device);
    mesh.setPositions(positions);
    mesh.setIndices(indices);
    mesh.update(PRIMITIVE_TRIANGLES, false);
    return mesh;
};

/**
 * Renders a collection of {@link WideLine} objects using a single instanced draw call per
 * camera/layer pass. Lines can use different widths, colors, caps, joins and dash patterns while
 * remaining in the same batch, as these properties are stored in per-segment instance data.
 *
 * Each {@link WideLine} describes a connected polyline in world space. Its width can vary per point
 * and is interpreted as screen pixels or world units according to
 * {@link WideLineRenderer#widthUnits}. A line can belong to only one WideLineRenderer at a time. Use
 * {@link WideLineRenderer#add} and {@link WideLineRenderer#remove} to transfer ownership without
 * changing the line data.
 *
 * ## Basic usage
 *
 * The following example creates a three-point line with a color gradient, variable width and
 * rounded ends and joins:
 *
 * ```javascript
 * const renderer = new WideLineRenderer(app);
 * const line = new WideLine();
 *
 * line.set(
 *     new Float32Array([
 *         -2, 0, 0,
 *          0, 1, 0,
 *          2, 0, 0
 *     ]),
 *     new Float32Array([
 *         1, 0, 0,
 *         1, 1, 0,
 *         0, 1, 1
 *     ]),
 *     new Float32Array([4, 12, 4])
 * );
 * line.cap = LINECAP_ROUND;
 * line.join = LINEJOIN_ROUND;
 * renderer.add(line);
 *
 * // Release GPU resources and detach all lines when no longer needed.
 * app.on('destroy', () => renderer.destroy());
 * ```
 *
 * Point data can be updated using {@link WideLine#setPositions}, {@link WideLine#setColors} and
 * {@link WideLine#setWidths}. These methods preserve the point count and reuse the line's existing
 * storage. Use {@link WideLine#set} when the point count needs to change.
 *
 * ## Performance
 *
 * Each line segment is rendered as one GPU instance. All segments owned by this renderer are
 * submitted together, so adding more WideLine objects does not add draw calls. A renderer with
 * visible segments issues one draw call for each camera that renders its layer. Multiple renderers
 * therefore provide useful update isolation, but each adds another draw call per camera/layer
 * pass.
 *
 * Changing any owned line marks the renderer dirty. Before the next render, instance data for all
 * of its lines is rebuilt and uploaded. For mixed workloads, place lines that rarely change in one
 * renderer and frequently updated lines in another. There is no static or dynamic mode; the
 * separation is achieved using two renderer instances. This prevents dynamic updates from
 * repeatedly rebuilding the static segment data:
 *
 * ```javascript
 * const staticLines = new WideLineRenderer(app);
 * const dynamicLines = new WideLineRenderer(app);
 *
 * staticLines.add(roadNetwork); // Built and uploaded once.
 * dynamicLines.add(projectilePath); // Updated frequently.
 * ```
 *
 * Buffer {@link WideLineRenderer#capacity} is measured in segments and grows automatically as
 * needed. Setting it in advance can avoid GPU buffer reallocations when the expected maximum
 * segment count is known. {@link WideLineRenderer#clear} removes the lines but retains this
 * capacity for reuse.
 *
 * ## Rendering behavior and limitations
 *
 * - Rendering is opaque. Packed colors contain rgb values, the alpha component of a {@link Color}
 *   is ignored and transparent lines are not supported.
 * - Widths use screen pixels by default. Set {@link WideLineRenderer#widthUnits} to
 *   {@link LINEWIDTH_WORLD} for camera-facing ribbons measured in world units.
 * - {@link WideLineRenderer#depthTest} and {@link WideLineRenderer#depthWrite} control interaction
 *   with the depth buffer. Both default to true.
 * - The renderer is added to the Immediate layer by default. Assign {@link WideLineRenderer#layer}
 *   to render it in another layer.
 * - The batch is not frustum culled. Disable the renderer using {@link WideLineRenderer#enabled}
 *   when none of its lines need to be rendered.
 * - Call {@link WideLineRenderer#destroy} to release the internal mesh, material and instance
 *   buffer. Detached lines remain usable and can be added to another renderer.
 *
 * See the following examples for interactive styling and update demonstrations:
 *
 * - {@link https://playcanvas.github.io/#/graphics/wide-line}
 * - {@link https://playcanvas.github.io/#/graphics/wide-lines-styles}
 * - {@link https://playcanvas.github.io/#/graphics/wide-lines-dynamic}
 *
 * @category Graphics
 */
class WideLineRenderer {
    /** @type {WideLine[]} */
    _lines = [];

    /** @type {Layer} */
    _layer;

    _depthTest = true;

    _depthWrite = true;

    _enabled = true;

    _widthUnits = LINEWIDTH_SCREEN;

    _capacity = 0;

    _segmentCount = 0;

    _dirty = true;

    _destroyed = false;

    /** @type {VertexBuffer|null} */
    _vertexBuffer = null;

    /** @type {Float32Array|null} */
    _instanceData = null;

    /**
     * Creates a new wide line renderer.
     *
     * @param {AppBase} app - The application.
     */
    constructor(app) {
        this.app = app;
        this.device = app.graphicsDevice;

        this._vertexFormat = new VertexFormat(this.device, [
            { semantic: SEMANTIC_ATTR8, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR9, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR10, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR11, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR12, components: 3, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR13, components: 3, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR14, components: 4, type: TYPE_FLOAT32 },
            { semantic: SEMANTIC_ATTR15, components: 4, type: TYPE_FLOAT32 }
        ]);

        this.material = new ShaderMaterial({
            uniqueName: 'WideLineRenderer',
            vertexGLSL,
            fragmentGLSL,
            vertexWGSL,
            fragmentWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                instance_prevWidth: SEMANTIC_ATTR8,
                instance_startWidth: SEMANTIC_ATTR9,
                instance_endDistance: SEMANTIC_ATTR10,
                instance_nextDistance: SEMANTIC_ATTR11,
                instance_startColor: SEMANTIC_ATTR12,
                instance_endColor: SEMANTIC_ATTR13,
                instance_style: SEMANTIC_ATTR14,
                instance_dashFlags: SEMANTIC_ATTR15
            }
        });
        this.material.cull = CULLFACE_NONE;
        this.material.alphaToCoverage = true;
        this.material.depthTest = this._depthTest;
        this.material.depthWrite = this._depthWrite;
        this.material.update();

        this.meshInstance = new MeshInstance(
            createTemplateMesh(this.device),
            this.material,
            new GraphNode('WideLineRenderer')
        );
        this.meshInstance.cull = false;
        this.meshInstance.pick = false;
        this.meshInstance.visible = false;

        const layer = app.scene.layers.getLayerByName('Immediate');
        if (!layer) {
            throw new Error('WideLineRenderer requires an Immediate layer.');
        }
        this._layer = layer;
        this._layer.addMeshInstances([this.meshInstance]);

        app.on('prerender', this._onPrerender, this);
    }

    /**
     * Adds a line to this renderer. A line can belong to only one renderer at a time.
     *
     * @param {WideLine} line - The line to add.
     */
    add(line) {
        if (!(line instanceof WideLine)) {
            throw new TypeError('line must be a WideLine.');
        }
        if (line._renderer) {
            throw new Error('WideLine is already owned by a WideLineRenderer.');
        }

        line._renderer = this;
        line._rendererIndex = this._lines.length;
        this._lines.push(line);
        this._dirty = true;
    }

    /**
     * Removes a line from this renderer without modifying its point data or style.
     *
     * @param {WideLine} line - The line to remove.
     * @returns {boolean} True if the line was owned by this renderer and was removed.
     */
    remove(line) {
        if (line?._renderer !== this) {
            return false;
        }

        const index = line._rendererIndex;
        const last = this._lines.pop();
        if (last !== line) {
            this._lines[index] = last;
            last._rendererIndex = index;
        }

        line._renderer = null;
        line._rendererIndex = -1;
        this._dirty = true;
        return true;
    }

    /**
     * Removes all lines. Allocated instance capacity is retained for reuse.
     */
    clear() {
        for (let i = 0; i < this._lines.length; i++) {
            const line = this._lines[i];
            line._renderer = null;
            line._rendererIndex = -1;
        }
        this._lines.length = 0;
        this._dirty = true;
    }

    /**
     * Releases all renderer-owned resources. Lines previously owned by this renderer remain
     * usable and can be added to another renderer.
     */
    destroy() {
        if (this._destroyed) {
            return;
        }
        this._destroyed = true;

        this.app.off('prerender', this._onPrerender, this);
        this.clear();
        this._layer.removeMeshInstances([this.meshInstance]);

        if (this._vertexBuffer) {
            this.meshInstance.setInstancing(null);
            this._vertexBuffer.destroy();
            this._vertexBuffer = null;
            this._instanceData = null;
        }

        this.meshInstance.destroy();
        this.material.destroy();
    }

    /**
     * The layer containing the renderer's mesh instance. Defaults to the Immediate layer.
     *
     * @type {Layer}
     */
    set layer(value) {
        if (!value) {
            throw new TypeError('layer must be a Layer.');
        }
        if (this._layer !== value) {
            this._layer?.removeMeshInstances([this.meshInstance]);
            this._layer = value;
            this._layer.addMeshInstances([this.meshInstance]);
        }
    }

    /**
     * Gets the layer containing the renderer's mesh instance.
     *
     * @type {Layer}
     */
    get layer() {
        return this._layer;
    }

    /**
     * Whether lines are tested against the depth buffer. Defaults to true.
     *
     * @type {boolean}
     */
    set depthTest(value) {
        value = !!value;
        if (this._depthTest !== value) {
            this._depthTest = value;
            this.material.depthTest = value;
        }
    }

    /**
     * Gets whether lines are tested against the depth buffer.
     *
     * @type {boolean}
     */
    get depthTest() {
        return this._depthTest;
    }

    /**
     * Whether lines write to the depth buffer. Defaults to true.
     *
     * @type {boolean}
     */
    set depthWrite(value) {
        value = !!value;
        if (this._depthWrite !== value) {
            this._depthWrite = value;
            this.material.depthWrite = value;
        }
    }

    /**
     * Gets whether lines write to the depth buffer.
     *
     * @type {boolean}
     */
    get depthWrite() {
        return this._depthWrite;
    }

    /**
     * Whether this renderer is visible. Defaults to true.
     *
     * @type {boolean}
     */
    set enabled(value) {
        value = !!value;
        if (this._enabled !== value) {
            this._enabled = value;
            this._updateVisibility();
        }
    }

    /**
     * Gets whether this renderer is visible.
     *
     * @type {boolean}
     */
    get enabled() {
        return this._enabled;
    }

    /**
     * Units used to interpret line widths. Can be {@link LINEWIDTH_SCREEN} for screen pixels or
     * {@link LINEWIDTH_WORLD} for world units. World-unit lines are camera-facing ribbons, not
     * three-dimensional tubes. Defaults to {@link LINEWIDTH_SCREEN}.
     *
     * @type {number}
     */
    set widthUnits(value) {
        if (value !== LINEWIDTH_SCREEN && value !== LINEWIDTH_WORLD) {
            throw new RangeError('widthUnits must be LINEWIDTH_SCREEN or LINEWIDTH_WORLD.');
        }

        if (this._widthUnits !== value) {
            this._widthUnits = value;
            this.material.setDefine('WIDE_LINE_WORLD_SPACE_WIDTH', value === LINEWIDTH_WORLD);
            this.material.update();
        }
    }

    /**
     * Gets the units used to interpret line widths.
     *
     * @type {number}
     */
    get widthUnits() {
        return this._widthUnits;
    }

    /**
     * Allocated instance capacity, measured in generated line segments. Defaults to zero and grows
     * automatically when required. Setting a smaller value releases unused capacity, but the
     * result is clamped to the number of segments currently required by the owned lines.
     *
     * @type {number}
     */
    set capacity(value) {
        if (!Number.isInteger(value) || value < 0) {
            throw new RangeError('capacity must be a non-negative integer.');
        }

        const capacity = Math.max(value, this._requiredSegmentCount());
        if (this._capacity !== capacity) {
            this._resize(capacity);
            this._dirty = true;
        }
    }

    /**
     * Gets the allocated instance capacity, measured in generated line segments.
     *
     * @type {number}
     */
    get capacity() {
        return this._capacity;
    }

    /** @ignore */
    _lineChanged(line) {
        if (line._renderer === this) {
            this._dirty = true;
        }
    }

    /** @ignore */
    _onPrerender() {
        if (this._dirty) {
            this._rebuild();
        }
    }

    /** @ignore */
    _requiredSegmentCount() {
        let count = 0;
        for (let i = 0; i < this._lines.length; i++) {
            const line = this._lines[i];
            const pointCount = line.pointCount;
            if (pointCount >= 2) {
                count += line._closed ? pointCount : pointCount - 1;
            }
        }
        return count;
    }

    /** @ignore */
    _resize(capacity) {
        if (this._vertexBuffer) {
            this.meshInstance.setInstancing(null);
            this._vertexBuffer.destroy();
            this._vertexBuffer = null;
            this._instanceData = null;
        }

        this._capacity = capacity;
        if (capacity > 0) {
            this._vertexBuffer = new VertexBuffer(this.device, this._vertexFormat, capacity, {
                usage: BUFFER_DYNAMIC
            });
            this._instanceData = new Float32Array(this._vertexBuffer.lock());
            this.meshInstance.setInstancing(this._vertexBuffer);
            this.meshInstance.instancingCount = 0;
        }
        this._updateVisibility();
    }

    /** @ignore */
    _rebuild() {
        const required = this._requiredSegmentCount();
        if (required > this._capacity) {
            const grownCapacity = Math.max(required, this._capacity > 0 ? this._capacity * 2 : required);
            this._resize(grownCapacity);
        }

        this._segmentCount = required;
        if (required === 0) {
            if (this.meshInstance.instancingData) {
                this.meshInstance.instancingCount = 0;
            }
            this._dirty = false;
            this._updateVisibility();
            return;
        }

        const data = this._instanceData;
        let instance = 0;
        for (let i = 0; i < this._lines.length; i++) {
            instance = this._writeLine(data, instance, this._lines[i]);
        }

        this._vertexBuffer.unlock();
        this.meshInstance.instancingCount = required;
        this._dirty = false;
        this._updateVisibility();
    }

    /** @ignore */
    _writeLine(data, instance, line) {
        const positions = line._positions;
        const colors = line._colors;
        const widths = line._widths;
        const pointCount = line.pointCount;
        if (pointCount < 2) {
            return instance;
        }

        const segmentCount = line._closed ? pointCount : pointCount - 1;
        let distance = 0;

        for (let segment = 0; segment < segmentCount; segment++) {
            const startIndex = segment;
            const endIndex = (segment + 1) % pointCount;
            const startConnected = line._closed || segment > 0;
            const endConnected = line._closed || segment < segmentCount - 1;
            const prevIndex = startConnected ? (startIndex + pointCount - 1) % pointCount : startIndex;
            const nextIndex = endConnected ? (endIndex + 1) % pointCount : endIndex;

            const startPosition = startIndex * 3;
            const endPosition = endIndex * 3;
            const dx = positions[endPosition] - positions[startPosition];
            const dy = positions[endPosition + 1] - positions[startPosition + 1];
            const dz = positions[endPosition + 2] - positions[startPosition + 2];
            const endDistance = distance + Math.sqrt(dx * dx + dy * dy + dz * dz);

            let offset = instance * FLOATS_PER_INSTANCE;
            offset = this._writePosition(data, offset, positions, prevIndex);
            data[offset++] = widths.length === 1 ? widths[0] : widths[startIndex];
            offset = this._writePosition(data, offset, positions, startIndex);
            data[offset++] = widths.length === 1 ? widths[0] : widths[endIndex];
            offset = this._writePosition(data, offset, positions, endIndex);
            data[offset++] = distance;
            offset = this._writePosition(data, offset, positions, nextIndex);
            data[offset++] = endDistance;
            offset = this._writeColor(data, offset, colors, startIndex);
            offset = this._writeColor(data, offset, colors, endIndex);
            data[offset++] = line._join;
            data[offset++] = line._cap;
            data[offset++] = line._dashLength;
            data[offset++] = line._gapLength;
            data[offset++] = line._dashOffset;
            data[offset++] = (startConnected ? 1 : 0) | (endConnected ? 2 : 0);
            data[offset++] = 0;
            data[offset] = 0;

            distance = endDistance;
            instance++;
        }

        return instance;
    }

    /** @ignore */
    _writePosition(data, offset, positions, point) {
        const source = point * 3;
        data[offset++] = positions[source];
        data[offset++] = positions[source + 1];
        data[offset++] = positions[source + 2];
        return offset;
    }

    /** @ignore */
    _writeColor(data, offset, colors, point) {
        const source = colors.length === 3 ? 0 : point * 3;
        data[offset++] = colors[source];
        data[offset++] = colors[source + 1];
        data[offset++] = colors[source + 2];
        return offset;
    }

    /** @ignore */
    _updateVisibility() {
        this.meshInstance.visible = this._enabled && this._segmentCount > 0;
    }
}

export { LINEWIDTH_SCREEN, LINEWIDTH_WORLD, WideLineRenderer };
