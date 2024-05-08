import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, SelectInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Debug Shader Rendering' },
            jsx(
                LabelGroup,
                { text: 'Mode' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'settings.shaderPassName' },
                    type: 'string',
                    options: [
                        { v: pc.SHADERPASS_FORWARD, t: 'None' },
                        { v: pc.SHADERPASS_ALBEDO, t: 'Albedo' },
                        { v: pc.SHADERPASS_OPACITY, t: 'Opacity' },
                        { v: pc.SHADERPASS_WORLDNORMAL, t: 'World Normal' },
                        { v: pc.SHADERPASS_SPECULARITY, t: 'Specularity' },
                        { v: pc.SHADERPASS_GLOSS, t: 'Gloss' },
                        { v: pc.SHADERPASS_METALNESS, t: 'Metalness' },
                        { v: pc.SHADERPASS_AO, t: 'AO' },
                        { v: pc.SHADERPASS_EMISSION, t: 'Emission' },
                        { v: pc.SHADERPASS_LIGHTING, t: 'Lighting' },
                        { v: pc.SHADERPASS_UV0, t: 'UV0' }
                    ]
                })
            )
        )
    );
}
