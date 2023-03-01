export default /* glsl */`
gl_FragColor.rgb *= litShaderArgs.opacity;
gl_FragColor.a = litShaderArgs.opacity;
`;
