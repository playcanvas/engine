export default /* wgsl */`

#if LIT_BLEND_TYPE == NORMAL || LIT_BLEND_TYPE == ADDITIVEALPHA || defined(LIT_ALPHA_TO_COVERAGE)

    output.color = vec4f(output.color.rgb, litArgs_opacity);

#elif LIT_BLEND_TYPE == PREMULTIPLIED

    output.color = vec4f(output.color.rgb * litArgs_opacity, litArgs_opacity);

#else

    output.color = vec4f(output.color.rgb, 1.0);

#endif
`;
