/**
 * This script allows GPU Profiling on Mac using Xcode's GPU Frame Capture. Please read the instructions
 * in the manual: https://developer.playcanvas.com/user-manual/optimization/gpu-profiling/
 */
var MacGPUProfiling = pc.createScript('MacGPUProfiling');

// Called once after all resources are loaded and initialized
MacGPUProfiling.prototype.initialize = function () {
    this.isInitialized = false;
    this.device = null;
    this.context = null;

    // this is not needed for WebGPU
    if (this.app.graphicsDevice.isWebGPU) return;

    // only needed on Mac
    if (pc.platform.name !== 'osx') return;

    // Create a new canvas for WebGPU with a smaller size
    this.webgpuCanvas = document.createElement('canvas');
    this.webgpuCanvas.width = 20;
    this.webgpuCanvas.height = 20;
    this.webgpuCanvas.style.position = 'absolute';
    this.webgpuCanvas.style.top = '20px';  // Adjust position if needed
    this.webgpuCanvas.style.left = '20px'; // Adjust position if needed
    document.body.appendChild(this.webgpuCanvas);

    // Start the asynchronous WebGPU initialization
    this.initWebGPU();
};

// Async function for WebGPU initialization
MacGPUProfiling.prototype.initWebGPU = async function () {
    // Check for WebGPU support
    if (!navigator.gpu) {
        console.error('WebGPU is not supported on this browser.');
        return;
    }

    // Get WebGPU adapter and device
    const adapter = await navigator.gpu.requestAdapter();
    this.device = await adapter.requestDevice();

    console.log('Created WebGPU device used for profiling');

    // Create a WebGPU context for the new canvas
    this.context = this.webgpuCanvas.getContext('webgpu');

    // Configure the WebGPU context
    const swapChainFormat = 'bgra8unorm';
    this.context.configure({
        device: this.device,
        format: swapChainFormat
    });

    // Mark initialization as complete
    this.isInitialized = true;

    // Hook into the 'frameend' event
    this.app.on('frameend', this.onFrameEnd, this);
};

// Called when the 'frameend' event is triggered
MacGPUProfiling.prototype.onFrameEnd = function () {
    // If WebGPU is not initialized yet, do nothing
    if (!this.isInitialized) return;

    // Clear the WebGPU surface to red after WebGL rendering
    this.clearToRed();
};

// Function to clear the WebGPU surface to red
MacGPUProfiling.prototype.clearToRed = function () {
    // Get the current texture to render to
    const textureView = this.context.getCurrentTexture().createView();

    // Create a command encoder
    const commandEncoder = this.device.createCommandEncoder();

    // Create a render pass descriptor with a red background
    const renderPassDescriptor = {
        colorAttachments: [{
            view: textureView,
            clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },  // Red background
            loadOp: 'clear',
            storeOp: 'store'
        }]
    };

    // render pass
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.end();

    // Submit the commands to the GPU
    this.device.queue.submit([commandEncoder.finish()]);
};
