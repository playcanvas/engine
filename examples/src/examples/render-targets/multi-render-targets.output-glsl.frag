#ifdef MYMRT_PASS
    // output world normal to target 1
    pcFragColor1 = vec4(litArgs_worldNormal * 0.5 + 0.5, 1.0);

    // output gloss to target 2
    pcFragColor2 = vec4(vec3(litArgs_gloss) , 1.0);
#endif
