import { Debug } from '../../../core/debug.js';
import { INTERPOLATION_CUBIC, INTERPOLATION_LINEAR, INTERPOLATION_STEP } from '../../anim/constants.js';
import { AnimCurve } from '../../anim/evaluator/anim-curve.js';
import { AnimData } from '../../anim/evaluator/anim-data.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { GltfAccessor } from './gltf-accessor.js';

/**
 * @import { GlbResourceExtension } from '../glb-resource-extension.js'
 */

// create the anim structure
const createAnimation = (gltfAnimation, animationIndex, gltfAccessors, bufferViews, nodes, meshes, gltfNodes) => {

    // create animation data block for the accessor
    const createAnimData = (gltfAccessor) => {
        return new AnimData(GltfAccessor.getNumComponents(gltfAccessor.type), GltfAccessor.getDataFloat32(gltfAccessor, bufferViews));
    };

    const interpMap = {
        'STEP': INTERPOLATION_STEP,
        'LINEAR': INTERPOLATION_LINEAR,
        'CUBICSPLINE': INTERPOLATION_CUBIC
    };

    // Input and output maps reference data by sampler input/output key.
    const inputMap = { };
    const outputMap = { };
    // The curve map stores temporary curve data by sampler index. Each curves input/output value will be resolved to an inputs/outputs array index after all samplers have been processed.
    // Curves and outputs that are deleted from their maps will not be included in the final AnimTrack
    const curveMap = { };
    let outputCounter = 1;

    let i;

    // convert samplers
    for (i = 0; i < gltfAnimation.samplers.length; ++i) {
        const sampler = gltfAnimation.samplers[i];

        // get input data
        if (!inputMap.hasOwnProperty(sampler.input)) {
            inputMap[sampler.input] = createAnimData(gltfAccessors[sampler.input]);
        }

        // get output data
        if (!outputMap.hasOwnProperty(sampler.output)) {
            outputMap[sampler.output] = createAnimData(gltfAccessors[sampler.output]);
        }

        const interpolation =
            sampler.hasOwnProperty('interpolation') &&
            interpMap.hasOwnProperty(sampler.interpolation) ?
                interpMap[sampler.interpolation] : INTERPOLATION_LINEAR;

        // create curve
        const curve = {
            paths: [],
            input: sampler.input,
            output: sampler.output,
            interpolation: interpolation
        };

        curveMap[i] = curve;
    }

    const quatArrays = [];

    const transformSchema = {
        'translation': 'localPosition',
        'rotation': 'localRotation',
        'scale': 'localScale'
    };

    const constructNodePath = (node) => {
        const path = [];
        while (node) {
            path.unshift(node.name);
            node = node.parent;
        }
        return path;
    };

    // All morph targets are included in a single channel of the animation, with all targets output data interleaved with each other.
    // This function splits each morph target out into it a curve with its own output data, allowing us to animate each morph target independently by name.
    const createMorphTargetCurves = (curve, gltfNode, entityPath) => {
        const out = outputMap[curve.output];
        if (!out) {
            Debug.warn(`glb-parser: No output data is available for the morph target curve (${entityPath}/graph/weights). Skipping.`);
            return;
        }

        // names of morph targets
        let targetNames;
        if (meshes && meshes[gltfNode.mesh]) {
            const mesh = meshes[gltfNode.mesh];
            if (mesh.hasOwnProperty('extras') && mesh.extras.hasOwnProperty('targetNames')) {
                targetNames = mesh.extras.targetNames;
            }
        }

        const outData = out.data;
        const morphTargetCount = outData.length / inputMap[curve.input].data.length;
        const keyframeCount = outData.length / morphTargetCount;

        // single array buffer for all keys, 4 bytes per entry
        const singleBufferSize = keyframeCount * 4;
        const buffer = new ArrayBuffer(singleBufferSize * morphTargetCount);

        for (let j = 0; j < morphTargetCount; j++) {
            const morphTargetOutput = new Float32Array(buffer, singleBufferSize * j, keyframeCount);

            // the output data for all morph targets in a single curve is interleaved. We need to retrieve the keyframe output data for a single morph target
            for (let k = 0; k < keyframeCount; k++) {
                morphTargetOutput[k] = outData[k * morphTargetCount + j];
            }
            const output = new AnimData(1, morphTargetOutput);
            const weightName = targetNames?.[j] ? `name.${targetNames[j]}` : j;

            // add the individual morph target output data to the outputMap using a negative value key (so as not to clash with sampler.output values)
            outputMap[-outputCounter] = output;
            const morphCurve = {
                paths: [{
                    entityPath: entityPath,
                    component: 'graph',
                    propertyPath: [`weight.${weightName}`]
                }],
                // each morph target curve input can use the same sampler.input from the channel they were all in
                input: curve.input,
                // but each morph target curve should reference its individual output that was just created
                output: -outputCounter,
                interpolation: curve.interpolation
            };
            outputCounter++;
            // add the morph target curve to the curveMap
            curveMap[`morphCurve-${i}-${j}`] = morphCurve;
        }
    };

    // convert anim channels
    for (i = 0; i < gltfAnimation.channels.length; ++i) {
        const channel = gltfAnimation.channels[i];
        const target = channel.target;
        const curve = curveMap[channel.sampler];

        const node = nodes[target.node];
        const gltfNode = gltfNodes[target.node];
        const entityPath = constructNodePath(node);

        if (target.path.startsWith('weights')) {
            createMorphTargetCurves(curve, gltfNode, entityPath);
            // as all individual morph targets in this morph curve have their own curve now, this morph curve should be flagged
            // so it's not included in the final output
            curveMap[channel.sampler].morphCurve = true;
        } else {
            curve.paths.push({
                entityPath: entityPath,
                component: 'graph',
                propertyPath: [transformSchema[target.path]]
            });
        }
    }

    const inputs = [];
    const outputs = [];
    const curves = [];

    // Add each input in the map to the final inputs array. The inputMap should now reference the index of input in the inputs array instead of the input itself.
    for (const inputKey in inputMap) {
        inputs.push(inputMap[inputKey]);
        inputMap[inputKey] = inputs.length - 1;
    }
    // Add each output in the map to the final outputs array. The outputMap should now reference the index of output in the outputs array instead of the output itself.
    for (const outputKey in outputMap) {
        outputs.push(outputMap[outputKey]);
        outputMap[outputKey] = outputs.length - 1;
    }
    // Create an AnimCurve for each curve object in the curveMap. Each curve object's input value should be resolved to the index of the input in the
    // inputs arrays using the inputMap. Likewise for output values.
    for (const curveKey in curveMap) {
        const curveData = curveMap[curveKey];
        // if the curveData contains a morph curve then do not add it to the final curve list as the individual morph target curves are included instead
        if (curveData.morphCurve) {
            continue;
        }
        curves.push(new AnimCurve(
            curveData.paths,
            inputMap[curveData.input],
            outputMap[curveData.output],
            curveData.interpolation
        ));

        // if this target is a set of quaternion keys, make note of its index so we can perform
        // quaternion-specific processing on it.
        if (curveData.paths.length > 0 && curveData.paths[0].propertyPath[0] === 'localRotation' && curveData.interpolation !== INTERPOLATION_CUBIC) {
            quatArrays.push(curves[curves.length - 1].output);
        }
    }

    // sort the list of array indexes so we can skip dups
    quatArrays.sort();

    // run through the quaternion data arrays flipping quaternion keys
    // that don't fall in the same winding order.
    let prevIndex = null;
    let data;
    for (i = 0; i < quatArrays.length; ++i) {
        const index = quatArrays[i];
        // skip over duplicate array indices
        if (i === 0 || index !== prevIndex) {
            data = outputs[index];
            if (data.components === 4) {
                const d = data.data;
                const len = d.length - 4;
                for (let j = 0; j < len; j += 4) {
                    const dp = d[j + 0] * d[j + 4] +
                             d[j + 1] * d[j + 5] +
                             d[j + 2] * d[j + 6] +
                             d[j + 3] * d[j + 7];

                    if (dp < 0) {
                        d[j + 4] *= -1;
                        d[j + 5] *= -1;
                        d[j + 6] *= -1;
                        d[j + 7] *= -1;
                    }
                }
            }
            prevIndex = index;
        }
    }

    // calculate duration of the animation as maximum time value
    let duration = 0;
    for (i = 0; i < inputs.length; i++) {
        data  = inputs[i]._data;
        duration = Math.max(duration, data.length === 0 ? 0 : data[data.length - 1]);
    }

    return new AnimTrack(
        gltfAnimation.hasOwnProperty('name') ? gltfAnimation.name : (`animation_${animationIndex}`),
        duration,
        inputs,
        outputs,
        curves);
};

const createAnimations = (device, gltf, bufferViews, nodes, options) => {
    if (!gltf.hasOwnProperty('animations') || gltf.animations.length === 0) {
        return [];
    }

    const preprocess = options?.animation?.preprocess;
    const postprocess = options?.animation?.postprocess;

    return gltf.animations.map((gltfAnimation, index) => {
        if (preprocess) {
            preprocess(gltfAnimation);
        }
        const animation = createAnimation(gltfAnimation, index, gltf.accessors, bufferViews, nodes, gltf.meshes, gltf.nodes);
        if (postprocess) {
            postprocess(gltfAnimation, animation);
        }
        return animation;
    });
};

/**
 * Creates the {@link AnimTrack}s of the animations of a glTF file, in the `animations` of the
 * parsed resources. Installed by the anim feature, so applications that do not use anim components
 * do not bundle the animation code, and glTF files load without their animations.
 *
 * @type {GlbResourceExtension}
 * @ignore
 */
const glbAnimations = {
    name: 'animations',
    resourceName: 'animations',
    createResources: createAnimations
};

export { glbAnimations };
