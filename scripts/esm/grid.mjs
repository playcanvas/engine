import {
    ShaderMaterial,
    SEMANTIC_POSITION,
    SEMANTIC_TEXCOORD0,
    BLEND_NORMAL,
    Color,
    Script
} from 'playcanvas';

/** @import { AppBase, Entity } from 'playcanvas' */

const vertexCode = /* glsl */ `
    attribute vec3 vertex_position;

    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;

    varying vec3 vPosition;

    void main(void) {
        vec4 worldPosition = matrix_model * vec4(vertex_position, 1.0);
        vPosition = worldPosition.xyz;
        gl_Position = matrix_viewProjection * worldPosition;
    }
`;

const fragmentCode = /* glsl */ `
    uniform vec3 uColorX;
    uniform vec3 uColorZ;
    uniform int uResolution;
    uniform vec3 view_position;

    varying vec3 vPosition;

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

    void main(void) {
        vec3 pos = vPosition;
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

        levelPos = pos * 0.1;
        levelSize = 2.0 / 1000.0;
        levelAlpha = pristineGrid(levelPos.xz, ddx * 0.1, ddy * 0.1, vec2(levelSize)) * fade;
        if (levelAlpha > epsilon) {
            vec3 color;
            vec2 loc = max(vec2(0.0), abs(levelPos.xz) - abs(ddx * 0.1) - abs(ddy * 0.1));
            if (loc.x < levelSize) {
                if (loc.y < levelSize) {
                    color = vec3(1.0);
                } else {
                    color = uColorZ;
                }
            } else if (loc.y < levelSize) {
                color = uColorX;
            } else {
                color = vec3(0.9);
            }
            gl_FragColor = vec4(color, levelAlpha);
            return;
        }

        levelPos = pos;
        levelSize = 1.0 / 100.0;
        levelAlpha = pristineGrid(levelPos.xz, ddx, ddy, vec2(levelSize)) * fade;
        if (levelAlpha > epsilon) {
            if (uResolution < 1) {
                discard;
            }
            gl_FragColor = vec4(vec3(0.7), levelAlpha);
            return;
        }

        levelPos = pos * 10.0;
        levelSize = 1.0 / 100.0;
        levelAlpha = pristineGrid(levelPos.xz, ddx * 10.0, ddy * 10.0, vec2(levelSize)) * fade;
        if (levelAlpha > epsilon) {
            if (uResolution < 2) {
                discard;
            }
            gl_FragColor = vec4(vec3(0.7), levelAlpha);
            return;
        }

        discard;
    }
`;

class Grid extends Script {
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
     * @type {ShaderMaterial}
     * @private
     */
    _material;

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
     * @type {number}
     * @private
     */
    _resolution = Grid.RESOLUTION_HIGH;

    initialize() {
        // ensure the entity has a render component
        if (!this.entity.render) {
            this.entity.addComponent('render', { type: 'plane' });
        }

        // create shader material
        this._material = new ShaderMaterial({
            uniqueName: 'grid-shader',
            vertexCode,
            fragmentCode,
            attributes: {
                vertex_position: SEMANTIC_POSITION,
                aUv0: SEMANTIC_TEXCOORD0
            }
        });
        this._material.blendType = BLEND_NORMAL;
        this._material.depthWrite = false;
        this._material.update();

        this.entity.render.material = this._material;
        this.entity.render.castShadows = false;

        // set the initial values
        this.colorX = this._colorX;
        this.colorZ = this._colorZ;
        this.resolution = this._resolution;
    }

    /**
     * @param {string} name - The name of the parameter.
     * @param {Color|number} value - The value of the parameter.
     * @private
     */
    _set(name, value) {

        if (!this._material) {
            return;
        }

        if (value instanceof Color) {
            this._material.setParameter(name, [value.r, value.g, value.b]);
        }

        if (typeof value === 'number') {
            this._material.setParameter(name, value);
        }
    }

    /**
     * @attribute
     * @title Grid Color X
     * @description The color of the grid lines along the X axis.
     * @type {Color}
     * @default [1, 0.3, 0.3, 1]
     */
    set colorX(value) {
        if (!(value instanceof Color)) {
            return;
        }
        this._colorX.copy(value);
        this._set('uColorX', this._colorX);
    }

    get colorX() {
        return this._colorX;
    }

    /**
     * @attribute
     * @title Grid Color Z
     * @description The color of the grid lines along the Z axis.
     * @type {Color}
     * @default [0.3, 0.3, 1, 1]
     */
    set colorZ(value) {
        if (!(value instanceof Color)) {
            return;
        }
        this._colorZ.copy(value);
        this._set('uColorZ', this._colorZ);
    }

    get colorZ() {
        return this._colorZ;
    }

    /**
     * @attribute
     * @title Grid Resolution
     * @description The resolution of the grid.
     * @type {number}
     * @default 2
     */
    set resolution(value) {
        this._resolution = value;
        this._set('uResolution', this._resolution);
    }

    get resolution() {
        return this._resolution;
    }
}

export { Grid };
