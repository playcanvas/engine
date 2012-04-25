pc.gfx.programlib.particle = {};

pc.gfx.programlib.particle.generateKey = function (options) {
    var key = "particle";
    return key;
}

pc.gfx.programlib.particle.generateVertexShader = function (options) {
    var code = "";

    // VERTEX SHADER INPUTS: ATTRIBUTES
    code += "attribute vec4 particle_uvLifeTimeFrameStart;\n"; // uv, lifeTime, frameStart
    code += "attribute vec4 particle_positionStartTime;\n";    // position.xyz, startTime
    code += "attribute vec4 particle_velocityStartSize;\n";    // velocity.xyz, startSize
    code += "attribute vec4 particle_accelerationEndSize;\n";  // acceleration.xyz, endSize
    code += "attribute vec4 particle_spinStartSpinSpeed;\n";   // spinStart.x, spinSpeed.y
    code += "attribute vec4 particle_colorMult;\n";            // multiplies color and ramp textures

    // VERTEX SHADER INPUTS: UNIFORMS
    code += "uniform mat4 matrix_viewProjection;\n";
    code += "uniform mat4 matrix_model;\n";
    code += "uniform mat4 matrix_viewInverse;\n";
    code += "uniform vec3 worldVelocity;\n";
    code += "uniform vec3 worldAcceleration;\n";
    code += "uniform float timeRange;\n";
    code += "uniform float time;\n";
    code += "uniform float timeOffset;\n";
    code += "uniform float frameDuration;\n";
    code += "uniform float numFrames;\n\n";

    // VERTEX SHADER OUTPUTS
    code += "varying vec2 vUv0;\n";
    code += "varying float vAge;\n";
    code += "varying vec4 vColor;\n\n";

    // VERTEX SHADER BODY
    code += "void main(void)\n";
    code += "{\n";
    code += "    vec2 uv = particle_uvLifeTimeFrameStart.xy;\n";
    code += "    float lifeTime = particle_uvLifeTimeFrameStart.z;\n";
    code += "    float frameStart = particle_uvLifeTimeFrameStart.w;\n";
    code += "    vec3 position = particle_positionStartTime.xyz;\n";
    code += "    float startTime = particle_positionStartTime.w;\n";
    code += "    vec3 velocity = (matrix_model * vec4(particle_velocityStartSize.xyz, 0.0)).xyz + worldVelocity;\n";
    code += "    float startSize = particle_velocityStartSize.w;\n";
    code += "    vec3 acceleration = (matrix_model * vec4(particle_accelerationEndSize.xyz, 0.0)).xyz + worldAcceleration;\n";
    code += "    float endSize = particle_accelerationEndSize.w;\n";
    code += "    float spinStart = particle_spinStartSpinSpeed.x;\n";
    code += "    float spinSpeed = particle_spinStartSpinSpeed.y;\n";
    code += "    float localTime = mod((time - timeOffset - startTime), timeRange);\n";
    code += "    float percentLife = localTime / lifeTime;\n";
    code += "    float frame = mod(floor(localTime / frameDuration + frameStart), numFrames);\n";
    code += "    float uOffset = frame / numFrames;\n";
    code += "    float u = uOffset + (uv.x + 0.5) * (1.0 / numFrames);\n";
    code += "    vUv0 = vec2(u, uv.y + 0.5);\n";
    code += "    vColor = particle_colorMult;\n";
    code += "    vec3 basisX = matrix_viewInverse[0].xyz;\n";
    code += "    vec3 basisZ = matrix_viewInverse[1].xyz;\n";
    code += "    float size = mix(startSize, endSize, percentLife);\n";
    code += "    size = (percentLife < 0.0 || percentLife > 1.0) ? 0.0 : size;\n";
    code += "    float s = sin(spinStart + spinSpeed * localTime);\n";
    code += "    float c = cos(spinStart + spinSpeed * localTime);\n";
    code += "    vec2 rotatedPoint = vec2(uv.x * c + uv.y * s, \n";
    code += "                             -uv.x * s + uv.y * c);\n";
    code += "    vec3 localPosition = vec3(basisX * rotatedPoint.x +\n";
    code += "                              basisZ * rotatedPoint.y) * size +\n";
    code += "                              velocity * localTime +\n";
    code += "                              acceleration * localTime * localTime + \n";
    code += "                              position;\n";
    code += "    vAge = percentLife;\n";
    code += "    gl_Position = matrix_viewProjection * vec4(localPosition + matrix_model[3].xyz, 1.0);\n";
    code += "}";
    
    return code;
}

pc.gfx.programlib.particle.generateFragmentShader = function (options) {
    var code = "";

    code += "precision mediump float;\n";

    // FRAGMENT SHADER INPUTS: VARYINGS
    code += "varying vec2 vUv0;\n";
    code += "varying float vAge;\n";
    code += "varying vec4 vColor;\n";

    // FRAGMENT SHADER INPUTS: UNIFORMS
    code += "uniform sampler2D texture_diffuseMap;\n";
    code += "uniform sampler2D texture_rampMap;\n\n";

    code += "void main(void)\n";
    code += "{\n";
    code += "    vec4 colorMult = texture2D(texture_rampMap, vec2(vAge, 0.5)) * vColor;\n";
    code += "    gl_FragColor = texture2D(texture_diffuseMap, vUv0) * colorMult;\n";
    code += "}";

    return code;
}