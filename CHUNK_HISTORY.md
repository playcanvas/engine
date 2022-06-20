This file contains a brief summary of changes made to chunks in the PlayCanvas Engine.

## v1.54

`clearCoatNormalPS`
- refrain from generating world CC reflection, now done on the backend instead
- normalize final world space normal

`clusteredLightPS`
- remove dead code

`diffuseDetailMapPS`
- Gamma correct detail map before combining with base albedo

`diffusePS`
- Fix gamma handling relative to albedo detail

`emissivePS`
- set `dEmissive` global instead of returning the value in order to bring it in line with the other frontend components

`endPS`
- combine emissive with `dEmissive` instead of a call to `getEmission()`

`lightmapAddPS, lightmapDirAddPS`
- new chunks for adding the lightmap values passed in from the backend

`lightmapDirPS, lightmapSinglePS`
- renamed the lightmap function to `getLightMap()` instead of `addLightMap()`
- changed the implementation to write `dLightmap` and `dLightmapDir` global instead of updating `dDiffuseLight` and `dSpecularLight` directly
- backend now handles combining lightmap in `lightmapAddPS` and `lightmapDirAddPS`

`lightmapSingleVert.js`
- removed (unused)

`lightSpecularAnisoGGXPS`
- added clear coat `#define`

`lightSpecularBlinnPS, lightSpecularPhongPS`
- added clear coat `#define`, removed call to `antiAliasGlossiness()`

`normalDetailMapPS`
- remove two (mostly) unnecessary calls to `normalise`- final normal is normalized instead

`normalMapFastPS`
- removed

`normalMapPS`
- added `MAPTEXTURE` #define like the other chunks
- normalize final normal
- when normal texture isn't defined, calculate normal from geometry normal instead

`normalVertexPS`
- removed chunk, moved functionality to `normalMapPS` frontend chunk

`specularAaNonePS, specularAaToksvigPS, specularAaToksvigFastPS`
- removed

`startPS`
- removed global declarations, generate them on demand instead

## v1.51

`ambientPrefilteredCubePS, ambientPrefilteredCubeLodPS, dpAtlasQuadPS, genParaboloidPS, prefilterCubemapPS, reflectionDpAtlasPS, reflectionPrefilteredCubePS, reflectionPrefilteredCubeLodPS`
- removed

`aoPS`
- #4150- rename function to `getAo` and modify it to set global value `dAo`
