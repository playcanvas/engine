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
                    min: -10,
                    max: 10,
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
            ),
            jsx(
                LabelGroup,
                { text: 'Bloom' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.bloom.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Bloom Intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.bloom.intensity' },
                    min: 0,
                    max: 0.2,
                    precision: 3
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Color Enhance' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.colorEnhance.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'shadows' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.colorEnhance.shadows' },
                    min: -3,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'highlights' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.colorEnhance.highlights' },
                    min: -3,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'midtones' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.colorEnhance.midtones' },
                    min: -1,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'vibrance' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.colorEnhance.vibrance' },
                    min: -1,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'dehaze' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.colorEnhance.dehaze' },
                    min: -1,
                    max: 1,
                    precision: 2
                })
            )
        )
    );
};
