
    localPos += particlePos;
    gl_Position = matrix_viewProjection * vec4(localPos, 1.0);
}

