
    localPos *= scale;
    localPos += particlePos;

    gl_Position = matrix_viewProjection * vec4(localPos.xyz, 1.0);
}
