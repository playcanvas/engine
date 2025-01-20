import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Settings' },
            jsx(
                LabelGroup,
                { text: 'Tonemapping' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.tonemapping' },
                    type: 'number',
                    options: [
                        { v: pc.TONEMAP_LINEAR, t: 'LINEAR' },
                        { v: pc.TONEMAP_FILMIC, t: 'FILMIC' },
                        { v: pc.TONEMAP_HEJL, t: 'HEJL' },
                        { v: pc.TONEMAP_ACES, t: 'ACES' },
                        { v: pc.TONEMAP_ACES2, t: 'ACES2' },
                        { v: pc.TONEMAP_NEUTRAL, t: 'NEUTRAL' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Fog' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.fog' },
                    type: 'string',
                    options: [
                        { v: pc.FOG_NONE, t: 'NONE' },
                        { v: pc.FOG_LINEAR, t: 'LINEAR' },
                        { v: pc.FOG_EXP, t: 'EXP' },
                        { v: pc.FOG_EXP2, t: 'EXP2' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Gamma' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.gamma' }
                })
            )
        )
    );
};
