// main shader of the lit fragment shader
export default /* glsl */`

#include "varyingsPS"
#include "litUserDeclarationPS"
#include "frontendDeclPS"

#if defined(PICK_PASS) || defined(PREPASS_PASS)

    #include "frontendCodePS"
    #include "litUserCodePS"
    #include "litOtherMainPS"

#elif defined(SHADOW_PASS)

    #include "frontendCodePS"
    #include "litUserCodePS"
    #include "litShadowMainPS"

#else // FORWARD_PASS

    #include "litForwardDeclarationPS"
    #include "litForwardPreCodePS"
    #include "frontendCodePS"
    #include "litForwardPostCodePS"
    #include "litForwardBackendPS"
    #include "litUserCodePS"
    #include "litForwardMainPS"

#endif

`;
