export default /* glsl */`

#if LIT_BLEND_TYPE == NORMAL || LIT_BLEND_TYPE == ADDITIVEALPHA || defined(LIT_ALPHA_TO_COVERAGE)

    gl_FragColor.a = litArgs_opacity;

#elif LIT_BLEND_TYPE == PREMULTIPLIED

    gl_FragColor.rgb *= litArgs_opacity;
    gl_FragColor.a = litArgs_opacity;

#else

    gl_FragColor.a = 1.0;

#endif
`;
