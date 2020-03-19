uniform sampler2D texture_msdfMap;

#ifdef GL_OES_standard_derivatives
#define USE_FWIDTH
#endif

#ifdef GL2
#define USE_FWIDTH
#endif

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

float map (float min, float max, float v) {
    return (v - min) / (max - min);
}


uniform float font_sdfIntensity; // intensity is used to boost the value read from the SDF, 0 is no boost, 1.0 is max boost
uniform float font_pxrange;      // the number of pixels between inside and outside the font in SDF
uniform float font_textureWidth; // the width of the texture atlas
uniform float font_textureHeight; // the height of the texture atlas

uniform vec4 outline_color;
uniform float outline_thickness;
uniform vec4 shadow_color;
uniform vec2 shadow_offset;

vec4 applyMsdf(vec4 color) {
    // sample the field
    vec3 tsample = texture2D(texture_msdfMap, vUv0).rgb;
    vec2 uvShdw = vUv0 - shadow_offset;
    vec3 ssample = texture2D(texture_msdfMap, uvShdw).rgb;
    // get the signed distance value
    float sigDist = median(tsample.r, tsample.g, tsample.b);
    float sigDistShdw = median(ssample.r, ssample.g, ssample.b);

    float tsamplea = texture2D(texture_msdfMap, vUv0).a;
    float ssamplea = texture2D(texture_msdfMap, uvShdw).a;
//    sigDist=mix(sigDist,tsamplea, clamp((outline_thickness-(0.15*0.2))*50.0,0.0,1.0));
//    sigDistShdw=mix(sigDistShdw,ssamplea, clamp((outline_thickness-(0.15*0.2))*50.0,0.0,1.0));

    sigDist=mix(sigDist,tsamplea, clamp((0.475-tsamplea)*10.0,0.0,1.0));
    sigDistShdw=mix(sigDistShdw,ssamplea, clamp((0.475-ssamplea)*10.0,0.0,1.0));

 /*   vec2 pUv0 = (floor(vUv0 * vec2(font_textureWidth, font_textureHeight))+vec2(0.0))*vec2(1.0/font_textureWidth, 1.0/font_textureHeight);
    vec3 psample = vec3(0);//texture2D(texture_msdfMap, pUv0).rgb;
    
    for (int xx=-1;xx<=1;xx++)
    {
        for (int yy=-1;yy<=1;yy++)
        {
            vec2 oUv0 = pUv0+vec2(float(xx), float(yy))*vec2(1.0/font_textureWidth, 1.0/font_textureHeight);
            psample = max(psample, texture2D(texture_msdfMap, oUv0).rgb);
        }
    }*/

    #ifdef USE_FWIDTH
        // smoothing depends on size of texture on screen
        vec2 w = fwidth(vUv0);
        float smoothing = 0.0;//clamp(w.x * font_textureWidth / font_pxrange, 0.0, 0.5);
    #else
        float font_size = 16.0; // TODO fix this
        // smoothing gets smaller as the font size gets bigger
        // don't have fwidth we can approximate from font size, this doesn't account for scaling
        // so a big font scaled down will be wrong...

        float smoothing = 0.0;//clamp(font_pxrange / font_size, 0.0, 0.5);
    #endif
    float mapMin = 0.05;
    float mapMax = clamp(1.0 - font_sdfIntensity, mapMin, 1.0);

    // remap to a smaller range (used on smaller font sizes)
    float sigDistInner = map(mapMin, mapMax, sigDist);
    float sigDistOutline = map(mapMin, mapMax, sigDist + outline_thickness*3.0);
    //float sigDistOutline = 0.0;//float(max(max(mix(tsample.r, -1.0, float(tsample.r>=0.5)), mix(tsample.g, -1.0, float(tsample.g>=0.5))), mix(tsample.b, -1.0, float(tsample.b>=0.5)))>(0.5-outline_thickness));
    
  /*  float rnum = float(psample.r<0.5);// && tsample.r>(0.5-outline_thickness));
    float gnum = float(psample.g<0.5);// && tsample.g>(0.5-outline_thickness));
    float bnum = float(psample.b<0.5);// && tsample.b>(0.5-outline_thickness));
    
    if ((rnum>0.0 && gnum>0.0))
    {
        sigDistOutline += float(min(tsample.r,tsample.g)>(0.5-outline_thickness));
    }
    if ((gnum>0.0 && bnum>0.0))
    {
        sigDistOutline += float(min(tsample.g,tsample.b)>(0.5-outline_thickness));
    }
    if ((bnum>0.0 && rnum>0.0))
    {
        sigDistOutline += float(min(tsample.b,tsample.r)>(0.5-outline_thickness));
    }
    if (sigDistOutline>1.0) sigDistOutline=1.0;*/

  //  float num=0.5-tsamplea;// min(min(mix(0.5-tsample.r, 1.0, float(psample.r>=0.5)),mix(0.5-tsample.g, 1.0, float(psample.g>=0.5))),mix(0.5-tsample.b, 1.0, float(psample.b>=0.5))); 
  //  sigDistOutline = float(num<=outline_thickness*2.0);

//    if ( rnum>0.0 && gnum<=0.0 && bnum<=0.0 )
 //   {
  //      sigDistOutline = 1.0;
   // }

    sigDistShdw = map(mapMin, mapMax, sigDistShdw + outline_thickness*3.0);

    float center = 0.5;
    // calculate smoothing and use to generate opacity
    float inside = smoothstep(center-smoothing, center+smoothing, sigDistInner);
    float outline = smoothstep(center-smoothing, center+smoothing, sigDistOutline);
    float shadow = smoothstep(center-smoothing, center+smoothing, sigDistShdw);

    vec4 tcolor = (outline > inside) ? outline * vec4(outline_color.a * outline_color.rgb, outline_color.a) : vec4(0.0);
//    vec4 tcolor = (outline > inside) ? outline * vec4(outline_color.a * vec3(rnum, gnum, bnum), outline_color.a) : vec4(0.0);
//    vec4 tcolor = (outline > inside) ? outline * vec4((vec3(1.0)-vec3(2.0)*max(vec3(0.5)-tsample.rgb,0.0)) * outline_color.rgb, outline_color.a) : vec4(0.0);
//    vec4 tcolor = (outline > inside) ? outline * vec4((vec3(1.0)-vec3(2.0)*max(vec3(0.5)-vec3(tsamplea),0.0)) * mix(outline_color.rgb, vec3(0,1,0), float(outline_thickness>0.0)*0.0)*outline_color.a, outline_color.a) : vec4(0.0);
//    float num=float(fract((sigDist+font_sdfIntensity)*16.0)<0.1);
//    vec4 tcolor = (outline >= outline) ? outline * vec4(vec3(num) * outline_color.rgb, outline_color.a) : vec4(0.0);
    tcolor = mix(tcolor, color, inside);

    vec4 scolor = (shadow > outline) ? shadow * vec4(shadow_color.a * shadow_color.rgb, shadow_color.a) : tcolor;
    tcolor = mix(scolor, tcolor, outline);
    
    if (tcolor.a==0.0)// outline_thickness==0.0 && inside==0.0)
    {
        discard;
    }
    return tcolor;
}