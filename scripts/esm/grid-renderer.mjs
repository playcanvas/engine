import {
    BLENDMODE_ONE,
    BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BLENDMODE_SRC_ALPHA,
    BLENDEQUATION_ADD,
    CULLFACE_NONE,
    PROJECTION_PERSPECTIVE,
    SEMANTIC_POSITION,
    BlendState,
    DepthState,
    QuadRender,
    Layer,
    createShaderFromCode,
    Script,
    Color,
    Mat4,
    Vec2,
    Vec3
// eslint-disable-next-line import/no-unresolved
} from 'playcanvas';

/** @import { AppBase, CameraComponent, GraphicsDevice } from 'playcanvas' */

// constants
const LAYER_NAME = 'Grid';

// temporary variables
const tmpV1 = new Vec3();
const tmpM1 = new Mat4();

const vertexShader = /* glsl*/ `
    uniform vec3 near_origin;
    uniform vec3 near_x;
    uniform vec3 near_y;

    uniform vec3 far_origin;
    uniform vec3 far_x;
    uniform vec3 far_y;

    attribute vec2 vertex_position;

    varying vec3 worldFar;
    varying vec3 worldNear;

    void main(void) {
        gl_Position = vec4(vertex_position, 0.0, 1.0);

        vec2 p = vertex_position * 0.5 + 0.5;
        worldNear = near_origin + near_x * p.x + near_y * p.y;
        worldFar = far_origin + far_x * p.x + far_y * p.y;
    }
`;

const fragmentShader = /* glsl*/ `
    uniform vec3 view_position;
    uniform mat4 matrix_viewProjection;
    uniform sampler2D blueNoiseTex32;

    uniform int resolution;

    uniform vec2 half_extents;

    uniform mat4 inv_transform;

    uniform vec3 color_x;
    uniform vec3 color_z;

    uniform bool depthMode;

    varying vec3 worldNear;
    varying vec3 worldFar;

    bool intersectPlane(inout float t, vec3 pos, vec3 dir, vec4 plane) {
        float d = dot(dir, plane.xyz);
        if (abs(d) < 1e-06) {
            return false;
        }

        float n = -(dot(pos, plane.xyz) + plane.w) / d;
        if (n < 0.0) {
            return false;
        }

        t = n;

        return true;
    }

    vec3 transformPoint(mat4 m, vec3 p) {
        return (m * vec4(p, 1.0)).xyz;
    }

    vec3 transformDirection(mat4 m, vec3 p) {
        return (m * vec4(p, 0.0)).xyz;
    }

    // https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8#1e7c
    float pristineGrid(in vec2 uv, in vec2 ddx, in vec2 ddy, vec2 lineWidth) {
        vec2 uvDeriv = vec2(length(vec2(ddx.x, ddy.x)), length(vec2(ddx.y, ddy.y)));
        bvec2 invertLine = bvec2(lineWidth.x > 0.5, lineWidth.y > 0.5);
        vec2 targetWidth = vec2(
            invertLine.x ? 1.0 - lineWidth.x : lineWidth.x,
            invertLine.y ? 1.0 - lineWidth.y : lineWidth.y
        );
        vec2 drawWidth = clamp(targetWidth, uvDeriv, vec2(0.5));
        vec2 lineAA = uvDeriv * 1.5;
        vec2 gridUV = abs(fract(uv) * 2.0 - 1.0);
        gridUV.x = invertLine.x ? gridUV.x : 1.0 - gridUV.x;
        gridUV.y = invertLine.y ? gridUV.y : 1.0 - gridUV.y;
        vec2 grid2 = smoothstep(drawWidth + lineAA, drawWidth - lineAA, gridUV);

        grid2 *= clamp(targetWidth / drawWidth, 0.0, 1.0);
        grid2 = mix(grid2, targetWidth, clamp(uvDeriv * 2.0 - 1.0, 0.0, 1.0));
        grid2.x = invertLine.x ? 1.0 - grid2.x : grid2.x;
        grid2.y = invertLine.y ? 1.0 - grid2.y : grid2.y;

        return mix(grid2.x, 1.0, grid2.y);
    }

    float calcDepth(vec3 p) {
        vec4 v = matrix_viewProjection * vec4(p, 1.0);
        #ifdef WEBGPU
            return (v.z / v.w);
        #else
            return (v.z / v.w) * 0.5 + 0.5;
        #endif
    }

    bool writeDepth(float alpha) {
        if (!depthMode) return true;
        vec2 uv = fract(gl_FragCoord.xy / 32.0);
        float noise = texture2DLodEXT(blueNoiseTex32, uv, 0.0).y;
        return alpha > noise;
    }

    void main(void) {
        vec3 p = transformPoint(inv_transform, worldNear);
        vec3 v = transformDirection(inv_transform, normalize(worldFar - worldNear));

        // intersect ray with the world xz plane
        float t;
        if (!intersectPlane(t, p, v, vec4(0, 1, 0, 0))) {
            discard;
        }

        // calculate grid intersection
        vec3 pos = p + v * t;
        vec2 ddx = dFdx(pos.xz);
        vec2 ddy = dFdy(pos.xz);

        float epsilon = 1.0 / 255.0;

        // discard if outside size
        if (abs(pos.x) > half_extents.x || abs(pos.z) > half_extents.y) {
            discard;
        }

        // calculate fade
        float fade = 1.0 - smoothstep(400.0, 1000.0, length(pos - view_position));
        if (fade < epsilon) {
            discard;
        }

        vec3 levelPos;
        float levelSize;
        float levelAlpha;

        // 10m grid with colored main axes
        levelPos = pos * 0.1;
        levelSize = 2.0 / 1000.0;
        levelAlpha = pristineGrid(levelPos.xz, ddx * 0.1, ddy * 0.1, vec2(levelSize)) * fade;
        if (levelAlpha > epsilon) {
            vec3 color;
            vec2 loc = abs(levelPos.xz);
            if (loc.x < levelSize) {
                if (loc.y < levelSize) {
                    color = vec3(1.0);
                } else {
                    color = color_z;
                }
            } else if (loc.y < levelSize) {
                color = color_x;
            } else {
                color = vec3(0.9);
            }
            gl_FragColor = vec4(color, levelAlpha);
            gl_FragDepth = writeDepth(levelAlpha) ? calcDepth(pos) : 1.0;
            return;
        }

        // 1m grid
        levelPos = pos;
        levelSize = 1.0 / 100.0;
        levelAlpha = pristineGrid(levelPos.xz, ddx, ddy, vec2(levelSize)) * fade;
        if (levelAlpha > epsilon) {
            if (resolution < 1) {
                discard;
            }
            gl_FragColor = vec4(vec3(0.7), levelAlpha);
            gl_FragDepth = writeDepth(levelAlpha) ? calcDepth(pos) : 1.0;
            return;
        }

        // 0.1m grid
        levelPos = pos * 10.0;
        levelSize = 1.0 / 100.0;
        levelAlpha = pristineGrid(levelPos.xz, ddx * 10.0, ddy * 10.0, vec2(levelSize)) * fade;
        if (levelAlpha > epsilon) {
            if (resolution < 2) {
                discard;
            }
            gl_FragColor = vec4(vec3(0.7), levelAlpha);
            gl_FragDepth = writeDepth(levelAlpha) ? calcDepth(pos) : 1.0;
            return;
        }

        discard;
    }
`;

class GridRenderer extends Script {
    /**
     * @type {number}
     */
    static RESOLUTION_LOW = 0;

    /**
     * @type {number}
     */
    static RESOLUTION_MEDIUM = 1;

    /**
     * @type {number}
     */
    static RESOLUTION_HIGH = 2;

    /**
     * @type {number}
     */
    _resolution = GridRenderer.RESOLUTION_HIGH;

    /**
     * @type {GraphicsDevice}
     */
    _device;

    /**
     * @type {QuadRender}
     * @private
     */
    _quadRender;

    /**
     * @type {BlendState}
     */
    _blendState = new BlendState(
        true,
        BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA,
        BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_SRC_ALPHA
    );

    /**
     * @type {Vec2}
     */
    _halfExtents = new Vec2(Infinity, Infinity);

    /**
     * @type {Color}
     * @private
     */
    _colorX = new Color(1, 0.3, 0.3);

    /**
     * @type {Color}
     * @private
     */
    _colorZ = new Color(0.3, 0.3, 1);

    /**
     * Creates a new layer for the grid.
     *
     * @param {AppBase} app - The app.
     * @param {string} [layerName] - The layer name. Defaults to 'Grid'.
     * @param {number} [layerIndex] - The layer index. Defaults to the end of the layer list.
     * @returns {Layer} The new layer.
     */
    static createLayer(app, layerName = LAYER_NAME, layerIndex) {
        const layer = new Layer({
            name: layerName,
            clearDepthBuffer: false
        });
        app.scene.layers.insert(layer, layerIndex ?? app.scene.layers.layerList.length);
        return layer;
    }

    /**
     * @param {object} args - The script arguments.
     */
    constructor(args) {
        super(args);
        const {
            layer,
            resolution,
            halfExtents,
            colorX,
            colorZ
        } = args.attributes;

        this.resolution = resolution;
        this.halfExtents = halfExtents;
        this.colorX = colorX;
        this.colorZ = colorZ;

        this._device = this.app.graphicsDevice;

        // create shader
        const shader = createShaderFromCode(this._device, vertexShader, fragmentShader, 'grid', {
            vertex_position: SEMANTIC_POSITION
        });
        this._quadRender = new QuadRender(shader);

        const targetLayer = layer ?? GridRenderer.createLayer(this.app, undefined, 1);

        this.app.scene.on('prerender:layer', (camera, layer, transparent) => {
            if (!camera.layers.includes(targetLayer.id)) {
                camera.layers = camera.layers.concat(targetLayer.id);
            }

            if (layer !== targetLayer || transparent) {
                return;
            }

            // get frustum corners in world space
            const points = camera.camera.getFrustumCorners(-100);
            const worldTransform = camera.entity.getWorldTransform();
            for (let i = 0; i < points.length; i++) {
                worldTransform.transformPoint(points[i], points[i]);
            }

            // near
            if (camera.projection === PROJECTION_PERSPECTIVE) {
                // perspective
                this._set('near_origin', worldTransform.getTranslation());
                this._set('near_x', Vec3.ZERO);
                this._set('near_y', Vec3.ZERO);
            } else {
                // orthographic
                this._set('near_origin', points[3]);
                this._set('near_x', tmpV1.sub2(points[0], points[3]));
                this._set('near_y', tmpV1.sub2(points[2], points[3]));
            }

            // far
            this._set('far_origin', points[7]);
            this._set('far_x', tmpV1.sub2(points[4], points[7]));
            this._set('far_y', tmpV1.sub2(points[6], points[7]));

            // resolution
            this._set('resolution', this._resolution);

            // size
            this._set('half_extents', this._halfExtents);

            // transform
            tmpM1.copy(this.entity.getWorldTransform()).invert();
            this._set('inv_transform', tmpM1);

            // colors
            this._set('color_x', this._colorX);
            this._set('color_z', this._colorZ);

            this._device.setCullMode(CULLFACE_NONE);
            this._device.setStencilState(null, null);
            this._device.setDepthState(DepthState.DEFAULT);

            // write color
            this._set('depthMode', false);
            this._device.setBlendState(this._blendState);
            this._quadRender.render();

            // write depth
            this._set('depthMode', true);
            this._device.setBlendState(BlendState.NOWRITE);
            this._quadRender.render();
        });
    }

    /**
     * Set the value of a uniform in the shader.
     *
     * @param {string} name - The name of the uniform.
     * @param {Color|Vec3|number} value - The value to set.
     * @private
     */
    _set(name, value) {
        if (value instanceof Color) {
            this._device.scope.resolve(name).setValue([value.r, value.g, value.b]);
        }

        if (value instanceof Mat4) {
            this._device.scope.resolve(name).setValue(value.data);
        }

        if (value instanceof Vec3) {
            this._device.scope.resolve(name).setValue([value.x, value.y, value.z]);
        }

        if (value instanceof Vec2) {
            this._device.scope.resolve(name).setValue([value.x, value.y]);
        }

        if (typeof value === 'number') {
            this._device.scope.resolve(name).setValue(value);
        }

    }

    /**
     * @attribute
     * @type {GridRenderer.RESOLUTION_HIGH | GridRenderer.RESOLUTION_MEDIUM | GridRenderer.RESOLUTION_LOW}
     */
    set resolution(value) {
        this._resolution = value ?? GridRenderer.RESOLUTION_HIGH;
    }

    get resolution() {
        return this._resolution;
    }

    /**
     * @attribute
     * @type {Vec2}
     */
    set halfExtents(value) {
        if (!(value instanceof Vec2)) {
            return;
        }
        this._halfExtents.set(value.x || Infinity, value.y || Infinity);
    }

    get halfExtents() {
        return this._halfExtents;
    }

    /**
     * @attribute
     * @type {Color}
     */
    set colorX(value) {
        if (!(value instanceof Color)) {
            return;
        }
        this._colorX.copy(value);
    }

    get colorX() {
        return this._colorX;
    }

    /**
     * @attribute
     * @type {Color}
     */
    set colorZ(value) {
        if (!(value instanceof Color)) {
            return;
        }
        this._colorZ.copy(value);
    }

    get colorZ() {
        return this._colorZ;
    }

    destroy() {
        this._quadRender.destroy();
    }
}

export { GridRenderer };
