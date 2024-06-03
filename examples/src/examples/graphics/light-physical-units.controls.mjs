/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, LabelGroup, Panel, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Lights' },
            jsx(
                LabelGroup,
                { text: 'Rect (lm)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.rect.luminance' },
                    min: 0.0,
                    max: 800000.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Point (lm)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.point.luminance' },
                    min: 0.0,
                    max: 800000.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Spot (lm)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.spot.luminance' },
                    min: 0.0,
                    max: 200000.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Spot angle' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.spot.aperture' },
                    min: 1.0,
                    max: 90.0
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Camera' },
            jsx(
                LabelGroup,
                { text: 'Aperture (F/x)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.camera.aperture' },
                    min: 1.0,
                    max: 16.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Shutter (1/x) s' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.camera.shutter' },
                    min: 1.0,
                    max: 1000.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'ISO' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.camera.sensitivity' },
                    min: 100.0,
                    max: 1000.0
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Scene' },
            jsx(
                LabelGroup,
                { text: 'Animate' },
                jsx(BooleanInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.camera.animate' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Physical' },
                jsx(BooleanInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.scene.physicalUnits' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Skylight' },
                jsx(BooleanInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.scene.sky' }
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Sky (lm/m2)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.sky.luminance' },
                    min: 0.0,
                    max: 100000.0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Sun (lm/m2)' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'script.sun.luminance' },
                    min: 0.0,
                    max: 100000.0
                })
            )
        )
    );
}
