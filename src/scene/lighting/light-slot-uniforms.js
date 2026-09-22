import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import {
    UNIFORMTYPE_FLOAT, UNIFORMTYPE_INT, UNIFORMTYPE_MAT4, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4
} from '../../platform/graphics/constants.js';
import { UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import {
    LIGHTSHAPE_PUNCTUAL, LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT,
    PROJECTION_ORTHOGRAPHIC
} from '../constants.js';
import { LightCamera } from '../renderer/light-camera.js';

/**
 * @import { Camera } from '../camera.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { Light } from '../light.js'
 * @import { Mat4 } from '../../core/math/mat4.js'
 */

// the local axes an area light's half extents are measured along
const _ltcWidthAxis = new Vec3(-0.5, 0, 0);
const _ltcHeightAxis = new Vec3(0, 0, 0.5);
const _ltcVec = new Vec3();

/**
 * The uniforms of one light slot - `light<N>_color`, `light<N>_direction` and so on, where N is
 * the slot. A slot is a position in the {@link LightList} of a pass, so an instance is not tied to
 * a light: whichever light holds the slot in a pass has its values written here, and whatever that
 * light needs is declared in the view uniform buffer format from here. Both read one set of names,
 * so the format and the values cannot disagree about what a slot's uniforms are called. The
 * lighting chunks are the third party to this - see lightDeclaration.js - and the shader
 * processors report a light uniform they do not find in the view format.
 *
 * Instances are made once per slot index by the renderer and live as long as it does, as they hold
 * nothing that depends on the light or the format.
 *
 * @ignore
 */
class LightSlotUniforms {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {number} slot - The light slot, the N of `light<N>_`.
     */
    constructor(device, slot) {
        const scope = device.scope;
        const prefix = `light${slot}_`;

        /** @type {number} */
        this.slot = slot;

        // cascade matrices are an array uniform, which the scope names by its first element
        this._paletteName = `${prefix}shadowMatrixPalette`;

        this.color = scope.resolve(`${prefix}color`);
        this.direction = scope.resolve(`${prefix}direction`);
        this.position = scope.resolve(`${prefix}position`);
        this.radius = scope.resolve(`${prefix}radius`);
        this.innerConeAngle = scope.resolve(`${prefix}innerConeAngle`);
        this.outerConeAngle = scope.resolve(`${prefix}outerConeAngle`);
        this.halfWidth = scope.resolve(`${prefix}halfWidth`);
        this.halfHeight = scope.resolve(`${prefix}halfHeight`);
        this.shadowMap = scope.resolve(`${prefix}shadowMap`);
        this.shadowMatrix = scope.resolve(`${prefix}shadowMatrix`);
        this.shadowParams = scope.resolve(`${prefix}shadowParams`);
        this.shadowIntensity = scope.resolve(`${prefix}shadowIntensity`);
        this.shadowSearchArea = scope.resolve(`${prefix}shadowSearchArea`);
        this.cameraParams = scope.resolve(`${prefix}cameraParams`);
        this.softShadowParams = scope.resolve(`${prefix}softShadowParams`);
        this.shadowMatrixPalette = scope.resolve(`${this._paletteName}[0]`);
        this.shadowCascadeDistances = scope.resolve(`${prefix}shadowCascadeDistances`);
        this.shadowCascadeCount = scope.resolve(`${prefix}shadowCascadeCount`);
        this.shadowCascadeBlend = scope.resolve(`${prefix}shadowCascadeBlend`);
        this.shadowCascadeParams = scope.resolve(`${prefix}shadowCascadeParams`);
        this.cookie = scope.resolve(`${prefix}cookie`);
        this.cookieIntensity = scope.resolve(`${prefix}cookieIntensity`);
        this.cookieMatrix = scope.resolve(`${prefix}cookieMatrix`);
        this.cookieOffset = scope.resolve(`${prefix}cookieOffset`);

        // the vector values, as the arrays the scope takes
        this._direction = new Float32Array(3);
        this._position = new Float32Array(3);
        this._halfWidth = new Float32Array(3);
        this._halfHeight = new Float32Array(3);
    }

    /**
     * Appends the formats of the uniforms the given light needs at this slot - the ones the
     * lighting chunks declare for it, see lightDeclaration.js. Textures are not uniforms and stay
     * in the mesh bind group. The set may be a superset of what a particular shader declares - a
     * member no shader reads costs only its bytes - but it must be a pure function of
     * {@link Light#key}, as the key of the light list identifies the format built from it.
     *
     * @param {UniformFormat[]} uniforms - The formats to append to.
     * @param {Light} light - The light holding the slot.
     */
    appendFormats(uniforms, light) {
        const type = light._type;
        const add = (scopeId, uniformType) => uniforms.push(new UniformFormat(scopeId.name, uniformType));

        add(this.color, UNIFORMTYPE_VEC3);

        if (type === LIGHTTYPE_DIRECTIONAL) {
            add(this.direction, UNIFORMTYPE_VEC3);
        } else {
            add(this.position, UNIFORMTYPE_VEC3);
            add(this.radius, UNIFORMTYPE_FLOAT);
            if (type === LIGHTTYPE_SPOT) {
                add(this.direction, UNIFORMTYPE_VEC3);
                add(this.innerConeAngle, UNIFORMTYPE_FLOAT);
                add(this.outerConeAngle, UNIFORMTYPE_FLOAT);
            }
        }

        // area lights
        if (light._shape !== LIGHTSHAPE_PUNCTUAL) {
            if (type === LIGHTTYPE_DIRECTIONAL) {
                add(this.position, UNIFORMTYPE_VEC3);
            }
            add(this.halfWidth, UNIFORMTYPE_VEC3);
            add(this.halfHeight, UNIFORMTYPE_VEC3);
        }

        // shadows - the shadow matrix is not used for omni shadows
        const castShadows = light.castShadows;
        if (castShadows) {
            if (type !== LIGHTTYPE_OMNI) {
                add(this.shadowMatrix, UNIFORMTYPE_MAT4);
            }
            add(this.shadowIntensity, UNIFORMTYPE_FLOAT);
            add(this.shadowParams, UNIFORMTYPE_VEC4);

            if (light._isPcss) {
                add(this.shadowSearchArea, UNIFORMTYPE_FLOAT);
                add(this.cameraParams, UNIFORMTYPE_VEC4);
                if (type === LIGHTTYPE_DIRECTIONAL) {
                    add(this.softShadowParams, UNIFORMTYPE_VEC4);
                    add(this.shadowCascadeParams, UNIFORMTYPE_MAT4);
                }
            }

            // cascades - declared for every directional caster, whatever its cascade count
            if (type === LIGHTTYPE_DIRECTIONAL) {
                uniforms.push(new UniformFormat(this._paletteName, UNIFORMTYPE_MAT4, 4));
                add(this.shadowCascadeDistances, UNIFORMTYPE_VEC4);
                add(this.shadowCascadeCount, UNIFORMTYPE_INT);
                add(this.shadowCascadeBlend, UNIFORMTYPE_FLOAT);
            }
        }

        // cookies - the cube cookie of an omni light reads the shadow matrix for its orientation,
        // and a spot light without shadows still needs the matrix to project its cookie
        if (light._cookie) {
            if (type === LIGHTTYPE_OMNI) {
                add(this.cookieIntensity, UNIFORMTYPE_FLOAT);
                add(this.shadowMatrix, UNIFORMTYPE_MAT4);
            } else if (type === LIGHTTYPE_SPOT) {
                add(this.cookieIntensity, UNIFORMTYPE_FLOAT);
                if (!castShadows) {
                    add(this.shadowMatrix, UNIFORMTYPE_MAT4);
                }
                if (light._cookieTransform) {
                    add(this.cookieMatrix, UNIFORMTYPE_VEC4);
                    add(this.cookieOffset, UNIFORMTYPE_VEC2);
                }
            }
        }
    }

    /**
     * Writes the values of the given light into the uniforms of this slot.
     *
     * @param {Light} light - The light holding the slot.
     * @param {Camera} camera - The camera, for the shadow data rendered for it.
     */
    dispatch(light, camera) {
        switch (light._type) {
            case LIGHTTYPE_DIRECTIONAL:
                this._dispatchDirectional(light, camera);
                break;
            case LIGHTTYPE_OMNI:
                this._dispatchOmni(light);
                break;
            case LIGHTTYPE_SPOT:
                this._dispatchSpot(light);
                break;
        }
    }

    /**
     * @param {Light} directional - The light.
     * @param {Camera} camera - The camera, for the shadow data rendered for it.
     * @private
     */
    _dispatchDirectional(directional, camera) {
        const wtm = directional._node.getWorldTransform();

        this.color.setValue(directional._colorLinear);

        // Directional lights shine down the negative Y axis
        wtm.getY(directional._direction).mulScalar(-1);
        directional._direction.normalize();
        this._setDirection(directional._direction);

        if (directional.shape !== LIGHTSHAPE_PUNCTUAL) {
            // non-punctual shape - NB directional area light specular is approximated by putting the area light at the far clip
            this._setLtcDirectional(wtm, directional._direction, camera._node.getPosition(), camera.farClip);
        }

        if (directional.castShadows) {

            // ortho projection does not support cascades
            Debug.call(() => {
                if (camera.projection === PROJECTION_ORTHOGRAPHIC && directional.numCascades !== 1) {
                    Debug.errorOnce(`Camera [${camera.node.name}] with orthographic projection cannot use cascaded shadows, expect incorrect rendering.`);
                }
            });

            const lightRenderData = directional.getRenderData(camera, 0);
            const biases = directional._getUniformBiasValues(lightRenderData);

            this.shadowMap.setValue(lightRenderData.shadowBuffer);
            this.shadowMatrix.setValue(lightRenderData.shadowMatrix.data);

            this.shadowMatrixPalette.setValue(directional._shadowMatrixPalette);
            this.shadowCascadeDistances.setValue(directional._shadowCascadeDistances);
            this.shadowCascadeCount.setValue(directional.numCascades);
            this.shadowCascadeBlend.setValue(1 - directional.cascadeBlend);
            this.shadowIntensity.setValue(directional.shadowIntensity);

            // PCSS-only uniforms — skipped for the common PCF / VSM paths, which don't
            // declare or read them in the shader.
            if (directional._isPcss) {

                this.softShadowParams.setValue(directional._softShadowParams);

                const shadowRT = lightRenderData.shadowCamera.renderTarget;
                if (shadowRT) {
                    this.shadowSearchArea.setValue(directional.penumbraSize / lightRenderData.shadowCamera.renderTarget.width * lightRenderData.projectionCompensation);
                }

                const cameraParams = directional._shadowCameraParams;
                cameraParams.length = 4;
                // ortho radius (world half-extent of the directional shadow camera) — consumed by world-space PCSS
                cameraParams[0] = lightRenderData.projectionCompensation;
                cameraParams[1] = lightRenderData.shadowCamera._farClip;
                cameraParams[2] = lightRenderData.shadowCamera._nearClip;
                cameraParams[3] = 1;
                this.cameraParams.setValue(cameraParams);

                // Cached cascades must use the radius and depth range that rendered their
                // shadow map, even while another cascade is being fitted to moving casters.
                // Each matrix column stores one cascade's camera parameters.
                const cascadeParams = directional._shadowCascadeParams ??= new Float32Array(16);
                for (let c = 0; c < 4; c++) {
                    const own = c < directional.numCascades ? directional.getRenderData(camera, c) : null;
                    const renderData = own?.projectionCompensation > 0 ? own : lightRenderData;
                    const shadowCamera = renderData.shadowCamera;
                    const offset = c * 4;
                    cascadeParams[offset] = renderData.projectionCompensation;
                    cascadeParams[offset + 1] = shadowCamera._farClip;
                    cascadeParams[offset + 2] = shadowCamera._nearClip;
                    cascadeParams[offset + 3] = 1;
                }
                this.shadowCascadeParams.setValue(cascadeParams);
            }

            const params = directional._shadowRenderParams;
            params.length = 4;
            params[0] = directional._shadowResolution;  // Note: this needs to change for non-square shadow maps (2 cascades). Currently square is used
            params[1] = biases.normalBias;
            params[2] = biases.bias;
            params[3] = 0;
            this.shadowParams.setValue(params);
        }
    }

    /**
     * @param {Light} omni - The light.
     * @private
     */
    _dispatchOmni(omni) {
        const wtm = omni._node.getWorldTransform();

        this.radius.setValue(omni.attenuationEnd);
        this.color.setValue(omni._colorLinear);
        wtm.getTranslation(omni._position);
        this._setPosition(omni._position);

        if (omni.shape !== LIGHTSHAPE_PUNCTUAL) {
            // non-punctual shape
            this._setLtcPositional(wtm);
        }

        if (omni.castShadows) {

            // shadow map
            const lightRenderData = omni.getRenderData(null, 0);
            this.shadowMap.setValue(lightRenderData.shadowBuffer);

            const biases = omni._getUniformBiasValues(lightRenderData);
            const params = omni._shadowRenderParams;
            params.length = 4;
            params[0] = omni._shadowResolution;
            params[1] = biases.normalBias;
            params[2] = biases.bias;
            params[3] = 1.0 / omni.attenuationEnd;
            this.shadowParams.setValue(params);
            this.shadowIntensity.setValue(omni.shadowIntensity);

            const pixelsPerMeter = omni.penumbraSize / lightRenderData.shadowCamera.renderTarget.width;
            this.shadowSearchArea.setValue(pixelsPerMeter);
            const cameraParams = omni._shadowCameraParams;

            cameraParams.length = 4;
            cameraParams[0] = 0; // unused
            cameraParams[1] = lightRenderData.shadowCamera._farClip;
            cameraParams[2] = lightRenderData.shadowCamera._nearClip;
            cameraParams[3] = 0;
            this.cameraParams.setValue(cameraParams);
        }
        if (omni._cookie) {
            this.cookie.setValue(omni._cookie);
            this.shadowMatrix.setValue(wtm.data);
            this.cookieIntensity.setValue(omni.cookieIntensity);
        }
    }

    /**
     * @param {Light} spot - The light.
     * @private
     */
    _dispatchSpot(spot) {
        const wtm = spot._node.getWorldTransform();

        this.innerConeAngle.setValue(spot._innerConeAngleCos);
        this.outerConeAngle.setValue(spot._outerConeAngleCos);
        this.radius.setValue(spot.attenuationEnd);
        this.color.setValue(spot._colorLinear);
        wtm.getTranslation(spot._position);
        this._setPosition(spot._position);

        if (spot.shape !== LIGHTSHAPE_PUNCTUAL) {
            // non-punctual shape
            this._setLtcPositional(wtm);
        }

        // Spots shine down the negative Y axis
        wtm.getY(spot._direction).mulScalar(-1);
        spot._direction.normalize();
        this._setDirection(spot._direction);

        if (spot.castShadows) {

            // shadow map
            const lightRenderData = spot.getRenderData(null, 0);
            this.shadowMap.setValue(lightRenderData.shadowBuffer);

            this.shadowMatrix.setValue(lightRenderData.shadowMatrix.data);

            const biases = spot._getUniformBiasValues(lightRenderData);
            const params = spot._shadowRenderParams;
            params.length = 4;
            params[0] = spot._shadowResolution;
            params[1] = biases.normalBias;
            params[2] = biases.bias;
            params[3] = 1.0 / spot.attenuationEnd;
            this.shadowParams.setValue(params);
            this.shadowIntensity.setValue(spot.shadowIntensity);

            const pixelsPerMeter = spot.penumbraSize / lightRenderData.shadowCamera.renderTarget.width;
            const fov = lightRenderData.shadowCamera._fov * math.DEG_TO_RAD;
            const fovRatio = 1.0 / Math.tan(fov / 2.0);
            this.shadowSearchArea.setValue(pixelsPerMeter * fovRatio);

            const cameraParams = spot._shadowCameraParams;
            cameraParams.length = 4;
            cameraParams[0] = 0; // unused
            cameraParams[1] = lightRenderData.shadowCamera._farClip;
            cameraParams[2] = lightRenderData.shadowCamera._nearClip;
            cameraParams[3] = 0;
            this.cameraParams.setValue(cameraParams);
        }

        if (spot._cookie) {

            // if shadow is not rendered, we need to evaluate light projection matrix
            if (!spot.castShadows) {
                const cookieMatrix = LightCamera.evalSpotCookieMatrix(spot);
                this.shadowMatrix.setValue(cookieMatrix.data);
            }

            this.cookie.setValue(spot._cookie);
            this.cookieIntensity.setValue(spot.cookieIntensity);
            if (spot._cookieTransform) {
                spot._cookieTransformUniform[0] = spot._cookieTransform.x;
                spot._cookieTransformUniform[1] = spot._cookieTransform.y;
                spot._cookieTransformUniform[2] = spot._cookieTransform.z;
                spot._cookieTransformUniform[3] = spot._cookieTransform.w;
                this.cookieMatrix.setValue(spot._cookieTransformUniform);
                spot._cookieOffsetUniform[0] = spot._cookieOffset.x;
                spot._cookieOffsetUniform[1] = spot._cookieOffset.y;
                this.cookieOffset.setValue(spot._cookieOffsetUniform);
            }
        }
    }

    /**
     * @param {Vec3} direction - The direction the light shines in.
     * @private
     */
    _setDirection(direction) {
        const value = this._direction;
        value[0] = direction.x;
        value[1] = direction.y;
        value[2] = direction.z;
        this.direction.setValue(value);
    }

    /**
     * @param {Vec3} position - The position of the light.
     * @private
     */
    _setPosition(position) {
        const value = this._position;
        value[0] = position.x;
        value[1] = position.y;
        value[2] = position.z;
        this.position.setValue(value);
    }

    /**
     * Sets the extents of a directional area light, placed at the far clip along the light.
     *
     * @param {Mat4} wtm - The world transform of the light.
     * @param {Vec3} dir - The direction the light shines in.
     * @param {Vec3} campos - The camera position.
     * @param {number} far - The camera far clip.
     * @private
     */
    _setLtcDirectional(wtm, dir, campos, far) {
        const position = this._position;
        position[0] = campos.x - dir.x * far;
        position[1] = campos.y - dir.y * far;
        position[2] = campos.z - dir.z * far;
        this.position.setValue(position);

        this._setLtcExtents(wtm, far);
    }

    /**
     * Sets the extents of an omni or spot area light.
     *
     * @param {Mat4} wtm - The world transform of the light.
     * @private
     */
    _setLtcPositional(wtm) {
        this._setLtcExtents(wtm, 1);
    }

    /**
     * @param {Mat4} wtm - The world transform of the light.
     * @param {number} scale - The scale of the extents.
     * @private
     */
    _setLtcExtents(wtm, scale) {
        const hWidth = wtm.transformVector(_ltcWidthAxis, _ltcVec);
        const halfWidth = this._halfWidth;
        halfWidth[0] = hWidth.x * scale;
        halfWidth[1] = hWidth.y * scale;
        halfWidth[2] = hWidth.z * scale;
        this.halfWidth.setValue(halfWidth);

        const hHeight = wtm.transformVector(_ltcHeightAxis, _ltcVec);
        const halfHeight = this._halfHeight;
        halfHeight[0] = hHeight.x * scale;
        halfHeight[1] = hHeight.y * scale;
        halfHeight[2] = hHeight.z * scale;
        this.halfHeight.setValue(halfHeight);
    }
}

export { LightSlotUniforms };
