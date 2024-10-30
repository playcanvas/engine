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
    createShaderFromCode,
    Script,
    Color,
    Vec3
} from 'playcanvas';

/** @import { CameraComponent } from 'playcanvas' */

const tmpV1 = new Vec3();

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

    uniform vec3 color_x;
    uniform vec3 color_z;

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
        return (v.z / v.w) * 0.5 + 0.5;
    }

    bool writeDepth(float alpha) {
        vec2 uv = fract(gl_FragCoord.xy / 32.0);
        float noise = texture2DLodEXT(blueNoiseTex32, uv, 0.0).y;
        return alpha > noise;
    }

    void main(void) {
        vec3 p = worldNear;
        vec3 v = normalize(worldFar - worldNear);

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
            gl_FragColor = vec4(vec3(0.7), levelAlpha);
            gl_FragDepth = writeDepth(levelAlpha) ? calcDepth(pos) : 1.0;
            return;
        }

        // 0.1m grid
        levelPos = pos * 10.0;
        levelSize = 1.0 / 100.0;
        levelAlpha = pristineGrid(levelPos.xz, ddx * 10.0, ddy * 10.0, vec2(levelSize)) * fade;
        if (levelAlpha > epsilon) {
            gl_FragColor = vec4(vec3(0.7), levelAlpha);
            gl_FragDepth = writeDepth(levelAlpha) ? calcDepth(pos) : 1.0;
            return;
        }

        discard;
    }
`;

class InfiniteGrid extends Script {
    /**
     * @type {CameraComponent}
     * @private
     */
    _camera;

    /**
     * @type {QuadRender}
     * @private
     */
    _quadRender;

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
     * @type {string}
     */
    layerName = 'World';

    /**
     * @param {object} args - The script arguments.
     */
    constructor(args) {
        super(args);

        if (!this.entity.camera) {
            throw new Error('InfiniteGrid script requires a camera component');
        }
        this.attach(this.entity.camera);
    }

    /**
     * Set the value of a uniform in the shader.
     *
     * @param {string} name - The name of the uniform.
     * @param {Color|Vec3} value - The value to set.
     * @private
     */
    _set(name, value) {
        const device = this.app.graphicsDevice;
        if (value instanceof Color) {
            device.scope.resolve(name).setValue([value.r, value.g, value.b]);
        }

        if (value instanceof Vec3) {
            device.scope.resolve(name).setValue([value.x, value.y, value.z]);
        }
    }

    /**
     * @type {Color}
     */
    set colorX(value) {
        this._colorX.copy(value);
        this._set('color_x', value);
    }

    get colorX() {
        return this._colorX;
    }

    /**
     * @type {Color}
     */
    set colorZ(value) {
        this._colorZ.copy(value);
        this._set('color_x', value);
    }

    get colorZ() {
        return this._colorZ;
    }

    /**
     * @param {CameraComponent} camera - The camera component.
     */
    attach(camera) {
        const device = this.app.graphicsDevice;
        const shader = createShaderFromCode(device, vertexShader, fragmentShader, 'infinite-grid', {
            vertex_position: SEMANTIC_POSITION
        });
        this._quadRender = new QuadRender(shader);

        // set initial colors
        this._set('color_x', this._colorX);
        this._set('color_z', this._colorZ);

        this.app.on('prerender', () => {
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
        });

        const blendState = new BlendState(
            true,
            BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA,
            BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_SRC_ALPHA
        );
        camera.onPreRenderLayer = (layer, transparent) => {
            if (layer.name === this.layerName && !transparent) {
                device.setBlendState(blendState);
                device.setCullMode(CULLFACE_NONE);
                device.setDepthState(DepthState.WRITEDEPTH);
                device.setStencilState(null, null);

                this._quadRender.render();
            }
        };
    }

    detach() {
        this._camera.onPreRenderLayer = null;
        this._camera = null;

        this._quadRender.destroy();
    }

    destroy() {
        this.detach();
    }
}

export { InfiniteGrid };
