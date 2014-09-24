
    vec3 basisX = matrix_viewInverse[0].xyz;
    vec3 basisZ = matrix_viewInverse[1].xyz;
    float size = mix(startSize, endSize, percentLife);
    size = (percentLife < 0.0 || percentLife > 1.0) ? 0.0 : size;
    float s = sin(spinStart + spinSpeed * localTime);
    float c = cos(spinStart + spinSpeed * localTime);
    vec2 rotatedPoint = vec2(uv.x * c + uv.y * s, 
                             -uv.x * s + uv.y * c);
    vec3 localPosition = vec3(basisX * rotatedPoint.x +
                              basisZ * rotatedPoint.y) * size +
                              velocity * localTime +
                              acceleration * localTime * localTime + 
                              position;
    vAge = percentLife;
    gl_Position = matrix_viewProjection * vec4(localPosition + matrix_model[3].xyz, 1.0);
}