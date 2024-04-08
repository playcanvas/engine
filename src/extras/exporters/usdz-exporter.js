import { CoreExporter } from "./core-exporter.js";
import { zipSync, strToU8 } from 'fflate';

import {
    SEMANTIC_POSITION,
    SEMANTIC_NORMAL,
    SEMANTIC_TEXCOORD0,
    SEMANTIC_TEXCOORD1
} from "../../platform/graphics/constants.js";

import { Color } from '../../core/math/color.js';

const ROOT_FILE_NAME = 'root';

const header = `#usda 1.0
(
    customLayerData = {
        string creator = "PlayCanvas UsdzExporter"
    }
    metersPerUnit = 1
    upAxis = "Y"
)
`;

const materialListTemplate = materials => `
def "Materials"
{
    ${materials.join('\n')}
}
`;

const meshTemplate = (faceVertexCounts, indices, normals, positions, uv0, uv1) => `
def "Mesh"
{
    def Mesh "Mesh"
    {
        int[] faceVertexCounts = [${faceVertexCounts}]
        int[] faceVertexIndices = [${indices}]
        normal3f[] normals = [${normals}] (
            interpolation = "vertex"
        )
        point3f[] points = [${positions}]
        texCoord2f[] primvars:st = [${uv0}] (
            interpolation = "vertex"
        )
        texCoord2f[] primvars:st1 = [${uv1}] (
            interpolation = "vertex"
        )
        uniform token subdivisionScheme = "none"
    }
}
`;

const meshInstanceTemplate = (nodeName, meshRefPath, worldMatrix, materialRefPath) => /* usd */`
def Xform "${nodeName}" (
    prepend references = ${meshRefPath}
)
{
    matrix4d xformOp:transform = ${worldMatrix}
    uniform token[] xformOpOrder = ["xformOp:transform"]

    rel material:binding = ${materialRefPath}
}
`;

const materialValueTemplate = (type, name, value) => `                    ${type} inputs:${name} = ${value}`;

/**
 * Implementation of the USDZ format exporter. Note that ASCII version of the format (USDA) is used.
 *
 * @category Exporter
 */
class UsdzExporter extends CoreExporter {
    /**
     * Maps a mesh to a reference (path) inside the usdz container
     *
     * @type {Map<import('../../scene/mesh.js').Mesh, string>}
     * @ignore
     */
    meshMap;

    /**
     * Maps a material to a reference (path) inside the usdz container
     *
     * @type {Map<import('../../scene/materials/material.js').Material, string>}
     * @ignore
     */
    materialMap;

    /**
     * A list of generated material usda contents, which are processed at the end
     *
     * @ignore
     */
    materials;

    /**
     * A map of texture requests
     *
     * @type {Map<import('../../platform/graphics/texture.js').Texture, string>}
     * @ignore
     */
    textureMap;

    /**
     * A set of used node names. Used in order to keep them unique.
     *
     * @type {Set<string>}
     * @ignore
     */
    nodeNames;

    /**
     * An object, storing a mapping between the file name and its content. Used as input to fflate to
     * zip up the data.
     *
     * @type {object}
     * @ignore
     */
    files;

    init() {
        this.meshMap = new Map();
        this.textureMap = new Map();
        this.materialMap = new Map();
        this.materials = [];
        this.files = {};
        this.nodeNames = new Set();
    }

    done() {
        this.meshMap = null;
        this.textureMap = null;
        this.materialMap = null;
        this.materials = null;
        this.files = null;
        this.nodeNames = null;
    }

    /**
     * Converts a hierarchy of entities to USDZ format.
     *
     * @param {import('../../framework/entity.js').Entity} entity - The root of the entity hierarchy to convert.
     * @param {object} options - Object for passing optional arguments.
     * @param {number} [options.maxTextureSize] - Maximum texture size. Texture is resized if over
     * the size.
     * @returns {Promise<ArrayBuffer>} - The USDZ file content.
     */
    build(entity, options = {}) {

        this.init();

        // root file should be first in USDZ archive so reserve place here
        this.addFile(null, ROOT_FILE_NAME);

        // find all mesh instances
        const allMeshInstances = [];
        if (entity) {
            const renders = entity.findComponents("render");
            renders.forEach((render) => {
                allMeshInstances.push(...render.meshInstances);
            });
        }

        let rootContent = '';
        allMeshInstances.forEach((meshInstance) => {
            rootContent += this.buildMeshInstance(meshInstance);
        });

        // add materials
        rootContent += materialListTemplate(this.materials);

        // when the root file is populated, add its content
        this.addFile(null, ROOT_FILE_NAME, '', rootContent);

        // process requested textures
        const textureOptions = {
            maxTextureSize: options.maxTextureSize
        };

        const textureArray = Array.from(this.textureMap.keys());
        const promises = [];
        for (let i = 0; i < textureArray.length; i++) {

            // for now store all textures as png
            // TODO: consider jpg if the alpha channel is not used
            const isRGBA = true;
            const mimeType = isRGBA ? 'image/png' : 'image/jpeg';

            // convert texture data to canvas
            const texture = textureArray[i];
            const texturePromise = this.textureToCanvas(texture, textureOptions).then((canvas) => {

                // if texture format is supported
                if (canvas) {

                    // async convert them to blog and then to array buffer
                    // eslint-disable-next-line no-promise-executor-return
                    return new Promise(resolve => canvas.toBlob(resolve, mimeType, 1)).then(
                        blob => blob.arrayBuffer()
                    );
                }

                // ignore it if we cannot convert it
                console.warn(`Export of texture ${texture.name} is not currently supported.`);

                // eslint-disable-next-line no-promise-executor-return
                return new Promise(resolve => resolve(null));
            });
            promises.push(texturePromise);
        }

        // when all textures are converted
        const finalData = Promise.all(promises).then((values) => {

            // add all textures as files
            values.forEach((textureArrayBuffer, index) => {
                const texture = textureArray[index];
                const ids = this.getTextureFileIds(texture);
                this.files[ids.fileName] = new Uint8Array(textureArrayBuffer);
            });

            // generate usdz
            this.alignFiles();
            const arraybuffer = zipSync(this.files, { level: 0 });

            this.done();

            return arraybuffer;
        });

        return finalData;
    }

    alignFiles() {

        // 64 byte alignment
        // https://github.com/101arrowz/fflate/issues/39#issuecomment-777263109
        let offset = 0;
        for (const filename in this.files) {

            const file = this.files[filename];
            const headerSize = 34 + filename.length;

            offset += headerSize;
            const offsetMod64 = offset & 63;

            if (offsetMod64 !== 4) {

                const padLength = 64 - offsetMod64;
                const padding = new Uint8Array(padLength);

                this.files[filename] = [file, { extra: { 12345: padding } }];
            }
            offset = file.length;
        }
    }

    getFileIds(category, name, ref, extension = 'usda') {

        // filename inside the zip archive
        const fileName = (category ? `${category}/` : '') + `${name}.${extension}`;

        // string representing a reference to the file and the refName object inside it
        const refName = `@./${fileName}@</${ref}>`;

        return { name, fileName, refName };
    }

    getTextureFileIds(texture) {
        return this.getFileIds('texture', `Texture_${texture.id}`, 'Texture', 'png');
    }

    addFile(category, uniqueId, refName = '', content = '') {

        // prepare the content with the header
        let contentU8 = null;
        if (content) {
            content = header + '\n' + content;
            contentU8 = strToU8(content);
        }

        const ids = this.getFileIds(category, uniqueId, refName);

        // file
        this.files[ids.fileName] = contentU8;

        return ids.refName;
    }

    getMaterialRef(material) {

        let materialRef = this.materialMap.get(material);
        if (!materialRef) {
            materialRef = this.buildMaterial(material);
            this.materialMap.set(material, materialRef);
        }

        return materialRef;

    }

    getMeshRef(mesh) {

        let meshRef = this.meshMap.get(mesh);
        if (!meshRef) {
            meshRef = this.buildMesh(mesh);
            this.meshMap.set(mesh, meshRef);
        }

        return meshRef;
    }

    buildArray2(array) {
        const components = [];
        const count = array.length;
        for (let i = 0; i < count; i += 2) {
            components.push(`(${array[i]}, ${1 - array[i + 1]})`);
        }
        return components.join(', ');
    }

    buildArray3(array) {
        const components = [];
        const count = array.length;
        for (let i = 0; i < count; i += 3) {
            components.push(`(${array[i]}, ${array[i + 1]}, ${array[i + 2]})`);
        }
        return components.join(', ');
    }

    buildMat4(mat) {
        const data = mat.data;
        const vectors = [];
        for (let i = 0; i < 16; i += 4) {
            vectors.push(`(${data[i]}, ${data[i + 1]}, ${data[i + 2]}, ${data[i + 3]})`);
        }
        return `( ${vectors.join(', ')} )`;
    }


    // format: https://graphics.pixar.com/usd/release/spec_usdpreviewsurface.html
    buildMaterial(material) {

        const materialName = `Material_${material.id}`;
        const materialPath = `/Materials/${materialName}`;
        const materialPropertyPath = property => `<${materialPath}${property}>`;

        const buildTexture = (texture, textureIds, mapType, uvChannel, tiling, offset, rotation, tintColor) => {

            // TODO: texture transform values are passed in but do not work correctly in many cases

            return `
                def Shader "Transform2d_${mapType}" (
                    sdrMetadata = {
                        string role = "math"
                    }
                )
                {
                    uniform token info:id = "UsdTransform2d"
                    float2 inputs:in.connect = ${materialPropertyPath(`/uvReader_${uvChannel}.outputs:result`)}
                    float inputs:rotation = ${rotation}
                    float2 inputs:scale = (${tiling.x}, ${tiling.y})
                    float2 inputs:translation = (${offset.x}, ${offset.y})
                    float2 outputs:result
                }

                def Shader "Texture_${texture.id}_${mapType}"
                {
                    uniform token info:id = "UsdUVTexture"
                    asset inputs:file = @${textureIds.fileName}@
                    float2 inputs:st.connect = ${materialPropertyPath(`/Transform2d_${mapType}.outputs:result`)}
                    token inputs:wrapS = "repeat"
                    token inputs:wrapT = "repeat"
                    float4 inputs:scale = (${tintColor.r}, ${tintColor.g}, ${tintColor.b}, ${tintColor.a})
                    float outputs:r
                    float outputs:g
                    float outputs:b
                    float3 outputs:rgb
                    float outputs:a
                }
            `;
        };

        const inputs = [];
        const samplers = [];

        const addTexture = (textureSlot, uniform, propType, propName, valueName, handleOpacity = false, tintTexture = false) => {

            const texture = material[textureSlot];
            if (texture) {

                // add texture file
                const textureIds = this.getTextureFileIds(texture);
                this.textureMap.set(texture, textureIds.refName);

                const channel = material[textureSlot + 'Channel'] || 'rgb';
                const textureValue = materialPropertyPath(`/${textureIds.name}_${valueName}.outputs:${channel}`);
                inputs.push(materialValueTemplate(propType, `${propName}.connect`, textureValue));

                if (handleOpacity) {
                    if (material.alphaTest > 0.0) {
                        // TODO: Alpha test is failing in usdz viewer on Mac, disabling for now
                        // inputs.push(materialValueTemplate('float', 'opacity.opacityThreshold', `${material.alphaTest}`));
                    }
                }

                const tiling = material[textureSlot + 'Tiling'];
                const offset = material[textureSlot + 'Offset'];
                const rotation = material[textureSlot + 'Rotation'];

                // which texture coordinate set to use
                const uvChannel = material[textureSlot + 'Uv'] === 1 ? 'st1' : 'st';

                // texture tint
                const tintColor = tintTexture && uniform ? uniform : Color.WHITE;

                samplers.push(buildTexture(texture, textureIds, valueName, uvChannel, tiling, offset, rotation, tintColor));

            } else if (uniform) {

                const value = propType === 'float' ? `${uniform}` : `(${uniform.r}, ${uniform.g}, ${uniform.b})`;
                inputs.push(materialValueTemplate(propType, propName, value));
            }
        };

        // add textures / material properties to the material
        addTexture('diffuseMap', material.diffuse, 'color3f', 'diffuseColor', 'diffuse', false, true);
        if (material.transparent || material.alphaTest > 0.0) {
            addTexture('opacityMap', material.opacity, 'float', 'opacity', 'opacity', true);
        }
        addTexture('normalMap', null, 'normal3f', 'normal', 'normal');
        addTexture('emissiveMap', material.emissive, 'color3f', 'emissiveColor', 'emissive', false, true);
        addTexture('aoMap', null, 'float', 'occlusion', 'occlusion');
        addTexture('metalnessMap', material.metalness, 'float', 'metallic', 'metallic');
        addTexture('glossMap', material.gloss, 'float', 'roughness', 'roughness');

        // main material object
        const materialObject = `
            def Material "${materialName}"
            {
                def Shader "PreviewSurface"
                {
                    uniform token info:id = "UsdPreviewSurface"
${inputs.join('\n')}
                    int inputs:useSpecularWorkflow = 0
                    token outputs:surface
                }

                token outputs:surface.connect = ${materialPropertyPath('/PreviewSurface.outputs:surface')}

                def Shader "uvReader_st"
                {
                    uniform token info:id = "UsdPrimvarReader_float2"
                    token inputs:varname = "st"
                    float2 inputs:fallback = (0.0, 0.0)
                    float2 outputs:result
                }

                def Shader "uvReader_st1"
                {
                    uniform token info:id = "UsdPrimvarReader_float2"
                    token inputs:varname = "st1"
                    float2 inputs:fallback = (0.0, 0.0)
                    float2 outputs:result
                }

                ${samplers.join('\n')}
            }
        `;

        this.materials.push(materialObject);

        return materialPropertyPath('');
    }

    buildMesh(mesh) {

        let positions = [];
        const indices = [];
        let normals = [];
        let uv0 = [];
        let uv1 = [];

        mesh.getVertexStream(SEMANTIC_POSITION, positions);
        mesh.getVertexStream(SEMANTIC_NORMAL, normals);
        mesh.getVertexStream(SEMANTIC_TEXCOORD0, uv0);
        mesh.getVertexStream(SEMANTIC_TEXCOORD1, uv1);
        mesh.getIndices(indices);

        // vertex counts for each faces (all are triangles)
        const indicesCount = indices.length || positions.length;
        const faceVertexCounts = Array(indicesCount / 3).fill(3).join(', ');

        // face indices if no index buffer
        if (!indices.length) {
            for (let i = 0; i < indicesCount; i++)
                indices[i] = i;
        }

        // missing normals or uvs
        const numVerts = positions.length / 3;
        normals = normals.length ? normals : Array(numVerts * 3).fill(0);
        uv0 = uv0.length ? uv0 : Array(numVerts * 2).fill(0);
        uv1 = uv1.length ? uv1 : Array(numVerts * 2).fill(0);

        positions = this.buildArray3(positions);
        normals = this.buildArray3(normals);
        uv0 = this.buildArray2(uv0);
        uv1 = this.buildArray2(uv1);
        const meshObject = meshTemplate(faceVertexCounts, indices, normals, positions, uv0, uv1);

        const refPath = this.addFile('mesh', `Mesh_${mesh.id}`, 'Mesh', meshObject);
        return refPath;
    }

    buildMeshInstance(meshInstance) {

        // build a mesh file, get back a reference path to it
        const meshRefPath = this.getMeshRef(meshInstance.mesh);

        // build a material file, get back a reference path to it
        const materialRefPath = this.getMaterialRef(meshInstance.material);

        // world matrix
        const worldMatrix = this.buildMat4(meshInstance.node.getWorldTransform());

        // sanitize node name
        const name = meshInstance.node.name.replace(/[^a-z0-9]/gi, '_');

        // make it unique
        let nodeName = name;
        while (this.nodeNames.has(nodeName)) {
            nodeName = `${name}_${Math.random().toString(36).slice(2, 7)}`;
        }
        this.nodeNames.add(nodeName);

        return meshInstanceTemplate(nodeName, meshRefPath, worldMatrix, materialRefPath);
    }
}

export { UsdzExporter };
