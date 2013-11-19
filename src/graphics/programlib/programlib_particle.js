pc.gfx.programlib.particle = {
    generateKey: function (device, options) {
        var key = "particle";
        if (options.billboard) key += '_bbrd';
        return key;
    },

    createShaderDefinition: function (device, options) {
        /////////////////////////
        // GENERATE ATTRIBUTES //
        /////////////////////////
        var attributes = {
            particle_uvLifeTimeFrameStart: pc.gfx.SEMANTIC_ATTR0,
            particle_positionStartTime: pc.gfx.SEMANTIC_ATTR1,
            particle_velocityStartSize: pc.gfx.SEMANTIC_ATTR2,
            particle_accelerationEndSize: pc.gfx.SEMANTIC_ATTR3,
            particle_spinStartSpinSpeed: pc.gfx.SEMANTIC_ATTR4,
            particle_colorMult: pc.gfx.SEMANTIC_ATTR5
        }
        if (!options.billboard) {
            attributes.particle_orientation = pc.gfx.SEMANTIC_ATTR6;
        }

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = '';

        // VERTEX SHADER INPUTS: ATTRIBUTES
        code += "attribute vec4 particle_uvLifeTimeFrameStart;\n"; // uv, lifeTime, frameStart
        code += "attribute vec4 particle_positionStartTime;\n";    // position.xyz, startTime
        code += "attribute vec4 particle_velocityStartSize;\n";    // velocity.xyz, startSize
        code += "attribute vec4 particle_accelerationEndSize;\n";  // acceleration.xyz, endSize
        code += "attribute vec4 particle_spinStartSpinSpeed;\n";   // spinStart.x, spinSpeed.y
        code += "attribute vec4 particle_colorMult;\n";            // multiplies color and ramp textures
        if (!options.billboard) {
            code += "attribute vec4 particle_orientation;\n";      // orientation quaternion
        }

        // VERTEX SHADER INPUTS: UNIFORMS
        code += "uniform mat4 matrix_viewProjection;\n";
        code += "uniform mat4 matrix_model;\n";
        code += "uniform mat4 matrix_viewInverse;\n";
        code += "uniform vec3 particle_worldVelocity;\n";
        code += "uniform vec3 particle_worldAcceleration;\n";
        code += "uniform float particle_timeRange;\n";
        code += "uniform float particle_time;\n";
        code += "uniform float particle_timeOffset;\n";
        code += "uniform float particle_frameDuration;\n";
        code += "uniform float particle_numFrames;\n\n";

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
        code += "    vec3 velocity = (matrix_model * vec4(particle_velocityStartSize.xyz, 0.0)).xyz + particle_worldVelocity;\n";
        code += "    float startSize = particle_velocityStartSize.w;\n";
        code += "    vec3 acceleration = (matrix_model * vec4(particle_accelerationEndSize.xyz, 0.0)).xyz + particle_worldAcceleration;\n";
        code += "    float endSize = particle_accelerationEndSize.w;\n";
        code += "    float spinStart = particle_spinStartSpinSpeed.x;\n";
        code += "    float spinSpeed = particle_spinStartSpinSpeed.y;\n";
        code += "    float localTime = mod((particle_time - particle_timeOffset - startTime), particle_timeRange);\n";
        code += "    float percentLife = localTime / lifeTime;\n";
        code += "    float frame = mod(floor(localTime / particle_frameDuration + frameStart), particle_numFrames);\n";
        code += "    float uOffset = frame / particle_numFrames;\n";
        code += "    float u = uOffset + (uv.x + 0.5) * (1.0 / particle_numFrames);\n";
        code += "    vUv0 = vec2(u, uv.y + 0.5);\n";
        code += "    vColor = particle_colorMult;\n";
        if (options.billboard) {
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
        } else {
            code += "    float size = mix(startSize, endSize, percentLife);\n";
            code += "    size = (percentLife < 0.0 || percentLife > 1.0) ? 0.0 : size;\n";
            code += "    float s = sin(spinStart + spinSpeed * localTime);\n";
            code += "    float c = cos(spinStart + spinSpeed * localTime);\n";
            code += "\n";
            code += "    vec4 rotatedPoint = vec4((uv.x * c + uv.y * s) * size, 0.0, (uv.x * s - uv.y * c) * size, 1.0);\n";
            code += "    vec3 center = velocity * localTime + acceleration * localTime * localTime + position;\n";
            code += "\n";
            code += "    vec4 q2 = particle_orientation + particle_orientation;\n";
            code += "    vec4 qx = particle_orientation.xxxw * q2.xyzx;\n";
            code += "    vec4 qy = particle_orientation.xyyw * q2.xyzy;\n";
            code += "    vec4 qz = particle_orientation.xxzw * q2.xxzz;\n";
            code += "\n";
            code += "    mat4 localMatrix =\n";
            code += "         mat4((1.0 - qy.y) - qz.z, qx.y + qz.w, qx.z - qy.w, 0,\n";
            code += "              qx.y - qz.w, (1.0 - qx.x) - qz.z, qy.z + qx.w, 0,\n";
            code += "              qx.z + qy.w, qy.z - qx.w, (1.0 - qx.x) - qy.y, 0,\n";
            code += "              center.x, center.y, center.z, 1);\n";
            code += "    rotatedPoint = localMatrix * rotatedPoint;\n";
            code += "    vAge = percentLife;\n";
            code += "    gl_Position = matrix_viewProjection * vec4(rotatedPoint.xyz + matrix_model[3].xyz, 1.0);\n";
        }
        code += "}";
        
        var vshader = code;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        code = getSnippet(device, 'fs_precision');

        // FRAGMENT SHADER INPUTS: VARYINGS
        code += "varying vec2 vUv0;\n";
        code += "varying float vAge;\n";
        code += "varying vec4 vColor;\n";

        // FRAGMENT SHADER INPUTS: UNIFORMS
        code += "uniform sampler2D texture_colorMap;\n";
        code += "uniform sampler2D texture_opacityMap;\n";
        code += "uniform sampler2D texture_rampMap;\n\n";

        code += "void main(void)\n";
        code += "{\n";
        code += "    vec4 colorMult = texture2D(texture_rampMap, vec2(vAge, 0.5)) * vColor;\n";
        code += "    vec3 rgb = texture2D(texture_colorMap, vUv0).rgb;\n";
        code += "    float a = texture2D(texture_opacityMap, vUv0).r;\n";
        code += "    gl_FragColor = vec4(rgb, a) * colorMult;\n";
        code += "}";

        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};