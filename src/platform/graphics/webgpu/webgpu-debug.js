import { Debug } from '../../../core/debug.js';
import { DebugGraphics } from '../debug-graphics.js';

/**
 * @import { WebgpuGraphicsDevice } from './webgpu-graphics-device.js'
 */

// Maximum number of times a duplicate error message is logged.
const MAX_DUPLICATES = 5;

/**
 * Internal WebGPU debug system. Note that the functions only execute in the debug build, and are
 * stripped out in other builds.
 */
class WebgpuDebug {
    static _scopes = [];

    static _markers = [];

    /** @type {Map<string,number>} */
    static _loggedMessages = new Map();

    /**
     * Start a validation error scope.
     *
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     */
    static validate(device) {
        device.wgpu.pushErrorScope('validation');
        WebgpuDebug._scopes.push('validation');
        WebgpuDebug._markers.push(DebugGraphics.toString());
    }

    /**
     * Start an out-of-memory error scope.
     *
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     */
    static memory(device) {
        device.wgpu.pushErrorScope('out-of-memory');
        WebgpuDebug._scopes.push('out-of-memory');
        WebgpuDebug._markers.push(DebugGraphics.toString());
    }

    /**
     * Start an internal error scope.
     *
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     */
    static internal(device) {
        device.wgpu.pushErrorScope('internal');
        WebgpuDebug._scopes.push('internal');
        WebgpuDebug._markers.push(DebugGraphics.toString());
    }

    /**
     * End the previous error scope, and print errors if any.
     *
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     * @param {string} label - The label for the error scope.
     * @param {...any} args - Additional parameters that form the error message.
     */
    static async end(device, label, ...args) {
        const header = WebgpuDebug._scopes.pop();
        const marker = WebgpuDebug._markers.pop();
        Debug.assert(header, 'Non matching end.');

        const error = await device.wgpu.popErrorScope();
        if (error) {
            const count = WebgpuDebug._loggedMessages.get(error.message) ?? 0;
            if (count < MAX_DUPLICATES) {
                const tooMany = count === MAX_DUPLICATES - 1 ? ' (Too many errors, ignoring this one from now)' : '';
                WebgpuDebug._loggedMessages.set(error.message, count + 1);
                console.error(`WebGPU ${label} ${header} error: ${error.message}`, tooMany, 'while rendering', marker, ...args);
            }
        }
    }

    /**
     * Ends the shader validation scope by retrieving and logging any compilation errors
     * or warnings from the shader module. Also handles WebGPU validation errors, while
     * avoiding duplicate error messages.
     *
     * @param {WebgpuGraphicsDevice} device - The WebGPU graphics device.
     * @param {GPUShaderModule} shaderModule - The compiled WebGPU shader module.
     * @param {string} source - The original shader source code.
     * @param {number} [contextLines] - The number of lines before and after the error to log.
     * @param {...any} args - Additional parameters providing context about the shader.
     */
    static async endShader(device, shaderModule, source, contextLines = 2, ...args) {
        const header = WebgpuDebug._scopes.pop();
        const marker = WebgpuDebug._markers.pop();
        Debug.assert(header, 'Non-matching error scope end.');

        // Capture popErrorScope error (if any)
        const error = await device.wgpu.popErrorScope();
        let errorMessage = '';

        if (error) {
            errorMessage += `WebGPU ShaderModule creation ${header} error: ${error.message}`;
            errorMessage += ` - While rendering ${marker}\n`;
        }

        // Get shader compilation errors
        const compilationInfo = await shaderModule.getCompilationInfo();

        if (compilationInfo.messages.length > 0) {
            // split source into lines
            const sourceLines = source.split('\n');

            compilationInfo.messages.forEach((message, index) => {
                const { type, lineNum, linePos, message: msg } = message;
                const lineIndex = lineNum - 1; // Convert to zero-based index

                errorMessage += `\n----- ${type.toUpperCase()} ${index + 1} context: :${lineNum}:${linePos} ${type}: ${msg}\n`;

                // Extract surrounding lines for context
                const startLine = Math.max(0, lineIndex - contextLines);
                const endLine = Math.min(sourceLines.length, lineIndex + contextLines + 1);

                for (let i = startLine; i < endLine; i++) {
                    const linePrefix = i === lineIndex ? '> ' : '  ';
                    errorMessage += `${linePrefix}${i + 1}: ${sourceLines[i]}\n`;
                }
            });
        }

        // only log if there are errors or messages
        if (errorMessage) {
            console.error(errorMessage, ...args);
        }
    }
}

export { WebgpuDebug };
