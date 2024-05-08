import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, LabelGroup, Panel, SliderInput, BooleanInput, SelectInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Settings' },
            jsx(
                LabelGroup,
                { text: 'Opacity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.opacity' },
                    min: 0.0,
                    max: 1,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Dither Color' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.opacityDither' },
                    type: 'string',
                    options: [
                        { v: pc.DITHER_NONE, t: 'None' },
                        { v: pc.DITHER_BAYER8, t: 'Bayer8' },
                        { v: pc.DITHER_BLUENOISE, t: 'BlueNoise' },
                        { v: pc.DITHER_IGNNOISE, t: 'IGNNoise' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Dither Shadow' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.opacityShadowDither' },
                    type: 'string',
                    options: [
                        { v: pc.DITHER_NONE, t: 'None' },
                        { v: pc.DITHER_BAYER8, t: 'Bayer8' },
                        { v: pc.DITHER_BLUENOISE, t: 'BlueNoise' },
                        { v: pc.DITHER_IGNNOISE, t: 'IGNNoise' }
                    ]
                })
            ),
            jsx(
                LabelGroup,
                { text: 'TAA (WIP)' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.taa' }
                })
            )
        )
    );
}
