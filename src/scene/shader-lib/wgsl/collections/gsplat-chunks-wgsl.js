import gsplatCenterVS from '../chunks/gsplat/vert/gsplatCenter.js';
import gsplatCommonVS from '../chunks/gsplat/vert/gsplatCommon.js';
import gsplatSplatVS from '../chunks/gsplat/vert/gsplatSplat.js';
import gsplatEvalSHVS from '../chunks/gsplat/vert/gsplatEvalSH.js';
import gsplatHelpersVS from '../chunks/gsplat/vert/gsplatHelpers.js';
import gsplatModifyVS from '../chunks/gsplat/vert/gsplatModify.js';
import gsplatModifyPS from '../chunks/gsplat/frag/gsplatModify.js';
import gsplatWorkBufferGeometryPS from '../chunks/gsplat/frag/gsplatWorkBufferGeometry.js';
import gsplatQuatToMat3VS from '../chunks/gsplat/vert/gsplatQuatToMat3.js';
import gsplatStructsVS from '../chunks/gsplat/vert/gsplatStructs.js';
import gsplatCornerVS from '../chunks/gsplat/vert/gsplatCorner.js';
import gsplatOutputVS from '../chunks/gsplat/vert/gsplatOutput.js';
import gsplatPS from '../chunks/gsplat/frag/gsplat.js';
import gsplatSourceVS from '../chunks/gsplat/vert/gsplatSource.js';
import gsplatVS from '../chunks/gsplat/vert/gsplat.js';
import gsplatHybridVS from '../chunks/gsplat/vert/gsplatHybrid.js';
import gsplatPackingPS from '../chunks/gsplat/frag/gsplatPacking.js';
import gsplatFormatVS from '../chunks/gsplat/vert/gsplatFormat.js';

// Format-specific chunks (merged decl + read)
import gsplatUncompressedVS from '../chunks/gsplat/vert/formats/uncompressed.js';
import gsplatUncompressedSHVS from '../chunks/gsplat/vert/formats/uncompressedSH.js';
import gsplatCompressedVS from '../chunks/gsplat/vert/formats/compressed.js';
import gsplatCompressedSHVS from '../chunks/gsplat/vert/formats/compressedSH.js';
import gsplatSogVS from '../chunks/gsplat/vert/formats/sog.js';
import gsplatSogSHVS from '../chunks/gsplat/vert/formats/sogSH.js';
import gsplatSogBlindVS from '../chunks/gsplat/vert/formats/sogBlind.js';
import gsplatContainerDeclVS from '../chunks/gsplat/vert/formats/containerDecl.js';
import gsplatContainerReadVS from '../chunks/gsplat/vert/formats/containerRead.js';
import gsplatContainerFloatReadVS from '../chunks/gsplat/vert/formats/containerFloatRead.js';

// Chunks the gsplat code reads by name, as source or templates it fills in
import gsplatCopyToWorkbufferPS from '../chunks/gsplat/frag/gsplatCopyToWorkbuffer.js';
import gsplatCopyInstancedQuadVS from '../chunks/gsplat/vert/gsplatCopyInstancedQuad.js';
import gsplatSogCentersPS from '../chunks/gsplat/frag/gsplatSogCenters.js';
import gsplatProcessPS from '../chunks/gsplat/frag/gsplatProcess.js';
import gsplatStreamDeclVS from '../chunks/gsplat/vert/gsplatStreamDecl.js';
import gsplatStreamOutputVS from '../chunks/gsplat/vert/gsplatStreamOutput.js';
import gsplatContainerSimpleReadVS from '../chunks/gsplat/vert/formats/containerSimpleRead.js';
import gsplatContainerCompactReadVS from '../chunks/gsplat/vert/formats/containerCompactRead.js';
import gsplatContainerPackedReadVS from '../chunks/gsplat/vert/formats/containerPackedRead.js';
import gsplatContainerCompactWritePS from '../chunks/gsplat/frag/formats/containerCompactWrite.js';
import gsplatContainerPackedWritePS from '../chunks/gsplat/frag/formats/containerPackedWrite.js';
import gsplatVaryingDeclVS from '../chunks/gsplat/varyings/gsplatVaryingDeclVS.js';
import gsplatVaryingDeclPS from '../chunks/gsplat/varyings/gsplatVaryingDeclPS.js';
import gsplatSogBlindFieldVS from '../chunks/gsplat/vert/formats/sogBlindField.js';
import gsplatComputeStreamDeclVS from '../chunks/gsplat/vert/gsplatComputeStreamDecl.js';
import gsplatVaryingFlushVS from '../chunks/gsplat/varyings/gsplatVaryingFlushVS.js';
import gsplatVaryingDeclCS from '../chunks/gsplat/varyings/gsplatVaryingDeclCS.js';
import gsplatVaryingCacheWriteCS from '../chunks/gsplat/varyings/gsplatVaryingCacheWriteCS.js';
import gsplatVaryingCacheReadVS from '../chunks/gsplat/varyings/gsplatVaryingCacheReadVS.js';

export const gsplatChunksWGSL = {
    gsplatCenterVS,
    gsplatCornerVS,
    gsplatCommonVS,
    gsplatSplatVS,
    gsplatEvalSHVS,
    gsplatHelpersVS,
    gsplatModifyVS,
    gsplatModifyPS,
    gsplatWorkBufferGeometryPS,
    gsplatStructsVS,
    gsplatQuatToMat3VS,
    gsplatOutputVS,
    gsplatPS,
    gsplatSourceVS,
    gsplatVS,
    gsplatHybridVS,
    gsplatPackingPS,
    gsplatFormatVS,
    gsplatUncompressedVS,
    gsplatUncompressedSHVS,
    gsplatCompressedVS,
    gsplatCompressedSHVS,
    gsplatSogVS,
    gsplatSogSHVS,
    gsplatSogBlindVS,
    gsplatContainerDeclVS,
    gsplatContainerReadVS,
    gsplatContainerFloatReadVS,
    gsplatCopyToWorkbufferPS,
    gsplatCopyInstancedQuadVS,
    gsplatSogCentersPS,
    gsplatProcessPS,
    gsplatStreamDeclVS,
    gsplatStreamOutputVS,
    gsplatContainerSimpleReadVS,
    gsplatContainerCompactReadVS,
    gsplatContainerPackedReadVS,
    gsplatContainerCompactWritePS,
    gsplatContainerPackedWritePS,
    gsplatVaryingDeclVS,
    gsplatVaryingDeclPS,
    gsplatSogBlindFieldVS,
    gsplatComputeStreamDeclVS,
    gsplatVaryingFlushVS,
    gsplatVaryingDeclCS,
    gsplatVaryingCacheWriteCS,
    gsplatVaryingCacheReadVS
};
