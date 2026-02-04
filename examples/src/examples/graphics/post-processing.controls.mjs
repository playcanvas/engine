import * as pc from 'playcanvas';

/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, BooleanInput, ColorPicker, LabelGroup, Panel, SelectInput, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            LabelGroup,
            { text: 'enabled' },
            jsx(BooleanInput, {
                type: 'toggle',
                binding: new BindingTwoWay(),
                link: { observer, path: 'data.enabled' }
            })
        ),
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
            ),
            jsx(
                LabelGroup,
                { text: 'Debug' },
                jsx(SelectInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.scene.debug' },
                    type: 'number',
                    options: [
                        { v: 0, t: 'NONE' },
                        { v: 1, t: 'BLOOM' },
                        { v: 2, t: 'VIGNETTE' },
                        { v: 3, t: 'SCENE' }
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
                { text: 'blur level' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.bloom.blurLevel' },
                    min: 1,
                    max: 16,
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
                    max: 2,
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
                    min: 0.5,
                    max: 1.5,
                    precision: 2
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
            ),
            jsx(
                LabelGroup,
                { text: 'color' },
                jsx(ColorPicker, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.vignette.color' }
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
                    max: 1,
                    precision: 2
                })
            )
        )
    );
};
