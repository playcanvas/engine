// @config
//
// Verify TRANSFORM_FEEDBACK_SEPARATE with multiple output buffers.
// The test checks that the vertex shader correctly writes uvec4 values into four separate transform feedback varyings,
// and that the results can be read back from GPU buffers with the expected values.
// It also validates buffer rotation across consecutive runs to ensure the input buffer and output buffers remain synchronized.
// Press Enter to start the test.
//
// @flag HIDDEN
// @flag WEBGPU_DISABLED

import {
    AppBase,
    AppOptions,
    FILLMODE_FILL_WINDOW,
    RESOLUTION_AUTO,
    createGraphicsDevice,
    TRANSFORM_FEEDBACK_SEPARATE,
    TYPE_UINT32,
    BUFFER_GPUDYNAMIC,
    VertexFormat,
    VertexBuffer,
    TransformFeedback,
    SEMANTIC_POSITION,
    PRIMITIVE_POINTS,
    KEY_ENTER,
    Keyboard
} from 'playcanvas';

import { deviceType } from 'examples/context';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const gfxOptions = {
    deviceTypes: [deviceType]
};

const device = await createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new AppOptions();
createOptions.keyboard = new Keyboard(window);
createOptions.graphicsDevice = device;

const app = new AppBase(canvas);
app.init(createOptions);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

app.start();

const outputDiv = (() => {
    let outputDiv = document.getElementById('tf-output-div');
    if (!outputDiv) {
        outputDiv = document.createElement('div');
        outputDiv.id = 'tf-output-div';
        document.body.appendChild(outputDiv);
    }
    outputDiv.innerHTML = '';
    outputDiv.style.cssText = `
        width: 100%;
        height: 100%;
        position: fixed;
        top: 0;
        overflow: auto;
    `;
    return outputDiv;
})();

function writeToDiv(message, isError = false) {
    const line = document.createElement('div');
    line.textContent = message;
    line.style.color = isError ? '#ff4d4f' : '#52c41a';
    line.style.fontWeight = 'bold';
    if (outputDiv.firstChild) {
        outputDiv.firstChild.before(line);
    }
    else {
        outputDiv.appendChild(line);
    }
}

const numComponents = 4;
const numBuffersOfStep = 4;

const vertexShader = `
    attribute uvec4 aValues;

    flat varying uvec4 out_Values0;
    flat varying uvec4 out_Values1;
    flat varying uvec4 out_Values2;
    flat varying uvec4 out_Values3;

    uvec4 calculateSlot(uvec4 cur, uint slot) {
        const uint numComponents = 4u;
        return uvec4(
            cur.x + (slot + 1u) * numComponents,
            cur.y + (slot + 1u) * numComponents,
            cur.z + (slot + 1u) * numComponents,
            cur.w + (slot + 1u) * numComponents
        );
    }

    void main() {
        out_Values0 = calculateSlot(aValues, 0u); // [1, 2, 3, 4] -> [5, 6, 7, 8]
        out_Values1 = calculateSlot(aValues, 1u); // [5, 6, 7, 8] -> [9, 10, 11, 12]
        out_Values2 = calculateSlot(aValues, 2u); // [9, 10, 11, 12] -> [13, 14, 15, 16]
        out_Values3 = calculateSlot(aValues, 3u); // [13, 14, 15, 16] -> [17, 18, 19, 20]
    }
`;

function getExpectedInputData(step) {
    const arr = new Array(numComponents);
    for (let componentIndex = 0; componentIndex < numComponents; componentIndex++) {
        const expectedComponentValue = numComponents * step + componentIndex + 1;
        arr[componentIndex] = expectedComponentValue;
    }
    return arr;
}

function getExpectedOutputData(step, slot) {
    const arr = new Array(numComponents);
    for (let componentIndex = 0; componentIndex < numComponents; componentIndex++) {
        const expectedComponentValue = numComponents * (step + slot + 1) + componentIndex + 1;
        arr[componentIndex] = expectedComponentValue;
    }
    return arr;
}

const shaderName = 'TestSeparateTransformFeedback';
const feedbackVaryings = ['out_Values0', 'out_Values1', 'out_Values2', 'out_Values3'];
const shader = TransformFeedback.createShader(device, vertexShader, shaderName, feedbackVaryings, TRANSFORM_FEEDBACK_SEPARATE);
const buffersFormat = new VertexFormat(device, [{ semantic: SEMANTIC_POSITION, asInt: true, type: TYPE_UINT32, components: numComponents }]);

/** @type {Uint32Array[]} */
const outDatas = [];
/** @type {VertexBuffer[]} */
const buffers = [];
const buffersLength = numBuffersOfStep + 1;

for (let bufferIndex = 0; bufferIndex < buffersLength; bufferIndex++) {

    const componentsValues = [];
    for (let componentIndex = 0; componentIndex < numComponents; componentIndex++) {
        // example for 4 components -> [1, 2, 3, 4] [5, 6, 7, 8] [9, 10, 11, 12] ...
        componentsValues.push(bufferIndex * numComponents + componentIndex + 1);
    }

    const data = new Uint32Array(componentsValues);
    const dataTmp = new Uint32Array(componentsValues);
    const buffer = new VertexBuffer(device, buffersFormat, 1, { usage: BUFFER_GPUDYNAMIC, data: dataTmp.buffer });

    outDatas.push(data);
    buffers.push(buffer);
}

let step = 0;
let circleIndex = 0;

function readBuffer(buf, outData) {
    const gl = device.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.impl.bufferId);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, outData);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function getSlots(circleIndex, numBuffersOfStep) {
    const indexes = [];
    for (let i = 0; i < numBuffersOfStep; i++) {
        indexes.push((step + i + 1) % buffersLength);
    }
    return indexes;
}

function checkComponents(inputData, expected, messageSuccess, messageError) {
    for (let componentIndex = 0; componentIndex < numComponents; componentIndex++) {
        if (inputData[componentIndex] !== expected[componentIndex]) {
            writeToDiv(`✖ ${messageError}`, true);
            writeToDiv(`Expected: [${Array.from(expected).join(', ')}]`, true);
            writeToDiv(`Actual: [${Array.from(inputData).join(', ')}]`, true);
            return false;
        }
    }

    writeToDiv(`✔ ${messageSuccess}`, false);
    writeToDiv(`Values match expected: [${Array.from(expected).join(', ')}]`, false);
    return true;
}

function readResultAndCheck(inputBuffer, slots, step) {
    const inputData = outDatas[0];
    const expectedInputData = getExpectedInputData(step);
    readBuffer(inputBuffer, inputData);
    checkComponents(inputData, expectedInputData, 'The input expected data have been obtained.', 'Invalid input data');
    for (let slot = 0; slot < slots.length; slot++) {
        const bufferIndex = slots[slot];
        const buffer = buffers[bufferIndex];
        const outputData = outDatas[slot + 1];
        const expectedOutputData = getExpectedOutputData(step, slot);
        readBuffer(buffer, outputData);
        checkComponents(outputData, expectedOutputData, `The output slot[${slot}] expected data have been obtained.`, `Invalid out data for slot[${slot}]`);
    }
}

function runTransformFeedback() {

    const inputBuffer = buffers[circleIndex];
    const slots = getSlots(circleIndex, numBuffersOfStep);

    const oldRt = device.getRenderTarget();
    device.setRenderTarget(null);

    device.updateBegin();
    device.setVertexBuffer(inputBuffer);
    device.setRaster(false);

    for (let slot = 0; slot < slots.length; slot++) {
        const bufferIndex = slots[slot];
        const buffer = buffers[bufferIndex];
        device.setTransformFeedbackBuffer(buffer, slot);
    }

    device.setShader(shader);
    device.draw({
        type: PRIMITIVE_POINTS,
        base: 0,
        count: 1,
        indexed: false
    });

    for (let slot = 0; slot < slots.length; slot++) {
        device.setTransformFeedbackBuffer(null, slot);
    }

    device.setRaster(true);
    device.updateEnd();
    device.setRenderTarget(oldRt);

    readResultAndCheck(inputBuffer, slots, step, circleIndex);

    circleIndex = (circleIndex + 1) % buffersLength;
    step++;
}

app.on('update', () => {
    if (app.keyboard?.wasPressed(KEY_ENTER)) {
        runTransformFeedback();
    }
});