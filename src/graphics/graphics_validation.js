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
        };
    }

    // Create wrapper functions for each WebGL function
    for (var member in gl) {
        if (typeof gl[member] === "function") {
            this[member] = makeWrapper(member);
        } else {
            this[member] = gl[member];
        }
    }

    this.errorString = {};
    this.errorString[gl.NO_ERROR         ] = "NO_ERROR";
    this.errorString[gl.INVALID_ENUM     ] = "INVALID_ENUM";
    this.errorString[gl.INVALID_VALUE    ] = "INVALID_VALUE";
    this.errorString[gl.INVALID_OPERATION] = "INVALID_OPERATION";
    this.errorString[gl.OUT_OF_MEMORY    ] = "OUT_OF_MEMORY";
    this.errorString[gl.INVALID_FRAMEBUFFER_OPERATION] = "INVALID_FRAMEBUFFER_OPERATION";
}

WebGLValidator.prototype.validate = function (functionName) {
    var gl = this.gl;
    var error = gl.getError();

    if (error !== gl.NO_ERROR) {
        pc.log.error("WebGL error from " + functionName + ": " + this.errorString[error]);
        return false;
    }

    return true;
};