import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, BooleanInput, SelectInput, LabelGroup, Panel, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Rendering' },
            jsx(
                LabelGroup,
                { text: 'HDR' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.hdr' }
                })
            )
        ),
        jsx(
            LabelGroup,
            { text: 'Scene Tonemap' },
            jsx(SelectInput, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'data.sceneTonemapping' },
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
            { text: 'LUT Intensity' },
            jsx(SliderInput, {
                binding: new BindingTwoWay(),
                link: { observer, path: 'data.colorLutIntensity' },
                min: 0,
                max: 1,
                precision: 2
            })
        )
    );
};
