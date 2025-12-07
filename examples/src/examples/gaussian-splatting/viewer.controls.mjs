import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Scene' },
            jsx(
                LabelGroup,
                { text: 'Skydome' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.skydome' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Orientation' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.orientation' },
                    type: 'number',
                    options: [
                        { v: 0, t: '0°' },
                        { v: 90, t: '90°' },
                        { v: 180, t: '180°' },
                        { v: 270, t: '270°' }
                    ]
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Tone & Color' },
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
                { text: 'Exposure (EV)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.grading.exposure' },
                    min: -5,
                    max: 5,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Contrast' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.grading.contrast' },
                    min: 0.5,
                    max: 1.5,
                    precision: 2
                })
            )
        )
    );
};

