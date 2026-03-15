#ifdef MYMRT_PASS
    // output world normal to target 1
    output.color1 = vec4f(litArgs_worldNormal * 0.5 + 0.5, 1.0);

    // output gloss to target 2
    output.color2 = vec4f(vec3f(litArgs_gloss) , 1.0);
#endif
