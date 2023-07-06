export default /* glsl */`
gl_FragColor.rgb *= litShaderArgs_opacity;
gl_FragColor.a = litShaderArgs_opacity;
`;
