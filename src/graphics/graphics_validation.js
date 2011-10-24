
WebGLValidator.ErrorString = {};
WebGLValidator.ErrorString[WebGLRenderingContext.NO_ERROR         ] = "NO_ERROR";
WebGLValidator.ErrorString[WebGLRenderingContext.INVALID_ENUM     ] = "INVALID_ENUM";
WebGLValidator.ErrorString[WebGLRenderingContext.INVALID_VALUE    ] = "INVALID_VALUE";
WebGLValidator.ErrorString[WebGLRenderingContext.INVALID_OPERATION] = "INVALID_OPERATION";
WebGLValidator.ErrorString[WebGLRenderingContext.OUT_OF_MEMORY    ] = "OUT_OF_MEMORY";
WebGLValidator.ErrorString[WebGLRenderingContext.INVALID_FRAMEBUFFER_OPERATION] = "INVALID_FRAMEBUFFER_OPERATION";

function WebGLValidator(gl) {

    // Store the real WebGL context
    this.gl = gl;

    // Internal function to create each wrapper function
    var self = this;
    function makeWrapper(member) {
        return function() {

            // Call the real WebGL function
            var result = self.gl[member].apply(self.gl, arguments);

            // Validate the WebGL error status
            self.validate(member);

            // Now return the result
            return result;
        }
    }

    // Create wrapper functions for each WebGL function
    var self = this;
    for (var member in gl) {
        if (typeof gl[member] === "function") {
            this[member] = makeWrapper(member);
        } else {
            this[member] = gl[member];
        }
    }
}

WebGLValidator.prototype.validate = function (functionName) {

    var error = this.gl.getError();

    if (error !== WebGLRenderingContext.NO_ERROR) {

        Log.error("WebGL error from " + functionName + ": " + WebGLValidator.ErrorString[error]);
        return false;
    }

    return true;
}
