import { Color } from '../../../../core/math/color.js';
import { math } from '../../../../core/math/math.js';
import { LIGHTFALLOFF_INVERSESQUARED } from '../../../../scene/constants.js';
import { Light, lightTypes } from '../../../../scene/light.js';
import { Entity } from '../../../entity.js';

// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_lights_punctual

// creates light component, adds it to the node and returns the created light component
const createLight = (gltfLight, node) => {
    const lightProps = {
        enabled: false,
        type: gltfLight.type === 'point' ? 'omni' : gltfLight.type,
        color: gltfLight.hasOwnProperty('color') ? new Color(gltfLight.color) : Color.WHITE,
        // when range is not defined, infinity should be used - but that causes infinity in bounds calculations
        range: gltfLight.hasOwnProperty('range') ? gltfLight.range : 9999,
        falloffMode: LIGHTFALLOFF_INVERSESQUARED,
        // TODO: (engine issue #3252) Set intensity to match glTF specification, which uses physically based values:
        // - Omni and spot lights use luminous intensity in candela (lm/sr)
        // - Directional lights use illuminance in lux (lm/m2).
        // Current implementation: clamps specified intensity to 0..2 range
        intensity: gltfLight.hasOwnProperty('intensity') ? math.clamp(gltfLight.intensity, 0, 2) : 1
    };

    // glTF spot light cone angles are in radians, PlayCanvas expects degrees
    // Defaults per glTF spec: innerConeAngle = 0, outerConeAngle = PI/4 (45 degrees)
    if (gltfLight.hasOwnProperty('spot')) {
        lightProps.innerConeAngle = gltfLight.spot.hasOwnProperty('innerConeAngle') ? gltfLight.spot.innerConeAngle * math.RAD_TO_DEG : 0;
        lightProps.outerConeAngle = gltfLight.spot.hasOwnProperty('outerConeAngle') ? gltfLight.spot.outerConeAngle * math.RAD_TO_DEG : 45;
    }

    // glTF stores light intensity in energy/area, convert to luminance
    // getLightUnitConversion expects angles in radians, use original glTF values
    if (gltfLight.hasOwnProperty('intensity')) {
        const outerAngleRad = gltfLight.spot?.outerConeAngle ?? (Math.PI / 4);
        const innerAngleRad = gltfLight.spot?.innerConeAngle ?? 0;
        lightProps.luminance = gltfLight.intensity * Light.getLightUnitConversion(lightTypes[lightProps.type], outerAngleRad, innerAngleRad);
    }

    // Rotate to match light orientation in glTF specification
    // Note that this adds a new entity node into the hierarchy that does not exist in the gltf hierarchy
    const lightEntity = new Entity(node.name);
    lightEntity.rotateLocal(90, 0, 0);

    lightEntity.addComponent('light', lightProps);
    return lightEntity;
};

const createLights = (gltf, nodes, options) => {

    let lights = null;

    if (gltf.hasOwnProperty('nodes') && gltf.hasOwnProperty('extensions') &&
        gltf.extensions.hasOwnProperty('KHR_lights_punctual') && gltf.extensions.KHR_lights_punctual.hasOwnProperty('lights')) {

        const gltfLights = gltf.extensions.KHR_lights_punctual.lights;
        if (gltfLights.length) {

            const preprocess = options?.light?.preprocess;
            const process = options?.light?.process ?? createLight;
            const postprocess = options?.light?.postprocess;

            // handle nodes with lights
            gltf.nodes.forEach((gltfNode, nodeIndex) => {
                if (gltfNode.hasOwnProperty('extensions') &&
                    gltfNode.extensions.hasOwnProperty('KHR_lights_punctual') &&
                    gltfNode.extensions.KHR_lights_punctual.hasOwnProperty('light')) {

                    const lightIndex = gltfNode.extensions.KHR_lights_punctual.light;
                    const gltfLight = gltfLights[lightIndex];
                    if (gltfLight) {
                        if (preprocess) {
                            preprocess(gltfLight);
                        }
                        const light = process(gltfLight, nodes[nodeIndex]);
                        if (postprocess) {
                            postprocess(gltfLight, light);
                        }

                        // add the light to node->light map
                        if (light) {
                            if (!lights) lights = new Map();
                            lights.set(gltfNode, light);
                        }
                    }
                }
            });
        }
    }

    return lights;
};

export { createLights };
