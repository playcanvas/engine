import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Scene Rendering' },
            jsx(
                LabelGroup,
                { text: 'resolution' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.scale' },
                    min: 0.2,
                    max: 1,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'background' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.background' },
                    min: 0,
                    max: 50,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'emissive' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.emissive' },
                    min: 0,
                    max: 400,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Tonemapping' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.tonemapping' },
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
            )
        ),
        jsx(
            Panel,
            { headerText: 'BLOOM' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.bloom.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.bloom.intensity' },
                    min: 0,
                    max: 100,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'last mip level' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.bloom.lastMipLevel' },
                    min: 1,
                    max: 10,
                    precision: 0
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Grading' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.grading.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'saturation' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.grading.saturation' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'brightness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.grading.brightness' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'contrast' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.grading.contrast' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Vignette' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.vignette.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'inner' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.vignette.inner' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'outer' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.vignette.outer' },
                    min: 0,
                    max: 3,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'curvature' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.vignette.curvature' },
                    min: 0.01,
                    max: 10,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.vignette.intensity' },
                    min: 0,
                    max: 1,
                    precision: 2
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Fringing' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.fringing.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'intensity' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.fringing.intensity' },
                    min: 0,
                    max: 100,
                    precision: 0
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'TAA (Work in Progress)' },
            jsx(
                LabelGroup,
                { text: 'enabled' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.taa.enabled' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'jitter' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.taa.jitter' },
                    min: 0,
                    max: 5,
                    precision: 2
                })
            )
        )
    );
}
