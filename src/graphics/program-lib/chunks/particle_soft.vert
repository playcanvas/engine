
    #ifdef GL2
        vec2 zw = (matrix_viewProjection * vec4(localPos,1.0)).zw;
        vDepth = (zw.x / zw.y) * 0.5 + 0.5;
        vDepth = (2.0 * camera_near) / (camera_far + camera_near - vDepth * (camera_far - camera_near)); // linearize // simplyfy: const1 / (const2 - vDepth * const3)
        vDepth *= camera_far;
    #else
        vDepth = -(matrix_view * vec4(localPos,1.0)).z;
    #endif
