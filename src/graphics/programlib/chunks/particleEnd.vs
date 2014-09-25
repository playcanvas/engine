
    float size = mix(startSize, endSize, percentLife);
    size = (percentLife < 0.0 || percentLife > 1.0) ? 0.0 : size;
    float s = sin(spinStart + spinSpeed * localTime);
    float c = cos(spinStart + spinSpeed * localTime);

    vec4 rotatedPoint = vec4((uv.x * c + uv.y * s) * size, 0.0, (uv.x * s - uv.y * c) * size, 1.0);
    vec3 center = velocity * localTime + acceleration * localTime * localTime + position;

    vec4 q2 = particle_orientation + particle_orientation;
    vec4 qx = particle_orientation.xxxw * q2.xyzx;
    vec4 qy = particle_orientation.xyyw * q2.xyzy;
    vec4 qz = particle_orientation.xxzw * q2.xxzz;

    mat4 localMatrix =
         mat4((1.0 - qy.y) - qz.z, qx.y + qz.w, qx.z - qy.w, 0,
              qx.y - qz.w, (1.0 - qx.x) - qz.z, qy.z + qx.w, 0,
              qx.z + qy.w, qy.z - qx.w, (1.0 - qx.x) - qy.y, 0,
              center.x, center.y, center.z, 1);
    rotatedPoint = localMatrix * rotatedPoint;
    vAge = percentLife;
    gl_Position = matrix_viewProjection * vec4(rotatedPoint.xyz + matrix_model[3].xyz, 1.0);
}
