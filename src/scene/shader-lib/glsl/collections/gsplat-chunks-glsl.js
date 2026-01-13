import gsplatCenterVS from '../chunks/gsplat/vert/gsplatCenter.js';
import gsplatCommonVS from '../chunks/gsplat/vert/gsplatCommon.js';
import gsplatCustomizeVS from '../chunks/gsplat/vert/gsplatCustomize.js';
import gsplatEvalSHVS from '../chunks/gsplat/vert/gsplatEvalSH.js';
import gsplatHelpersVS from '../chunks/gsplat/vert/gsplatHelpers.js';
import gsplatModifyVS from '../chunks/gsplat/vert/gsplatModify.js';
import gsplatQuatToMat3VS from '../chunks/gsplat/vert/gsplatQuatToMat3.js';
import gsplatStructsVS from '../chunks/gsplat/vert/gsplatStructs.js';
import gsplatCornerVS from '../chunks/gsplat/vert/gsplatCorner.js';
import gsplatOutputVS from '../chunks/gsplat/vert/gsplatOutput.js';
import gsplatPS from '../chunks/gsplat/frag/gsplat.js';
import gsplatSourceVS from '../chunks/gsplat/vert/gsplatSource.js';
import gsplatVS from '../chunks/gsplat/vert/gsplat.js';
import gsplatWorkBufferVS from '../chunks/gsplat/vert/formats/workBuffer.js';
import gsplatPackingPS from '../chunks/gsplat/frag/gsplatPacking.js';
import gsplatFormatVS from '../chunks/gsplat/vert/gsplatFormat.js';

// Format-specific chunks (merged decl + read)
import gsplatUncompressedVS from '../chunks/gsplat/vert/formats/uncompressed.js';
import gsplatUncompressedSHVS from '../chunks/gsplat/vert/formats/uncompressedSH.js';
import gsplatCompressedVS from '../chunks/gsplat/vert/formats/compressed.js';
import gsplatCompressedSHVS from '../chunks/gsplat/vert/formats/compressedSH.js';
import gsplatSogsVS from '../chunks/gsplat/vert/formats/sogs.js';
import gsplatSogsSHVS from '../chunks/gsplat/vert/formats/sogsSH.js';
import gsplatContainerDeclVS from '../chunks/gsplat/vert/formats/containerDecl.js';
import gsplatContainerReadVS from '../chunks/gsplat/vert/formats/containerRead.js';

export const gsplatChunksGLSL = {
    gsplatCenterVS,
    gsplatCornerVS,
    gsplatCommonVS,
    gsplatCustomizeVS,
    gsplatEvalSHVS,
    gsplatHelpersVS,
    gsplatModifyVS,
    gsplatQuatToMat3VS,
    gsplatStructsVS,
    gsplatOutputVS,
    gsplatPS,
    gsplatSourceVS,
    gsplatVS,
    gsplatWorkBufferVS,
    gsplatPackingPS,
    gsplatFormatVS,
    gsplatUncompressedVS,
    gsplatUncompressedSHVS,
    gsplatCompressedVS,
    gsplatCompressedSHVS,
    gsplatSogsVS,
    gsplatSogsSHVS,
    gsplatContainerDeclVS,
    gsplatContainerReadVS
};
