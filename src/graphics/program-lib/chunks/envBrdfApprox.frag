//Adapted from https://www.unrealengine.com/en-US/blog/physically-based-shading-on-mobile
vec3 envBRDFApprox( vec3 SpecularColor, float Roughness, float NoV )
{
	const vec4 c0 = vec4( -1, -0.0275, -0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, -0.04 );
	vec4 r = Roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( -9.28 * NoV ) ) * r.x + r.y;
	vec2 AB = vec2( -1.04, 1.04 ) * a004 + r.zw;
	return SpecularColor * AB.x + AB.y;
}

vec3 envBRDF(vec3 specularColor, float glossiness, vec3 normal)
{
    return envBRDFApprox(specularColor, 1.0-glossiness, dot(normal, dViewDirW) );
}
