/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export function controls({ observer, ReactPCUI, React, jsx, fragment }) {
    const { BindingTwoWay, BooleanInput, Label, LabelGroup, Panel, SliderInput } = ReactPCUI;
    return fragment(
        jsx(
            Panel,
            { headerText: 'Lightmap Filter Settings' },
            jsx(
                LabelGroup,
                { text: 'enable' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.settings.lightmapFilterEnabled' },
                    value: observer.get('data.settings.lightmapFilterEnabled')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'range' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.settings.lightmapFilterRange' },
                    value: observer.get('data.settings.lightmapFilterRange'),
                    min: 1,
                    max: 20,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'smoothness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.settings.lightmapFilterSmoothness' },
                    value: observer.get('data.settings.lightmapFilterSmoothness'),
                    min: 0.1,
                    max: 2,
                    precision: 1
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Ambient light' },
            jsx(
                LabelGroup,
                { text: 'bake' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.ambientBake' },
                    value: observer.get('data.ambient.ambientBake')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'cubemap' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.cubemap' },
                    value: observer.get('data.ambient.cubemap')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'hemisphere' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.hemisphere' },
                    value: observer.get('data.ambient.hemisphere')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'samples' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.ambientBakeNumSamples' },
                    value: observer.get('data.ambient.ambientBakeNumSamples'),
                    max: 64,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'contrast' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.ambientBakeOcclusionContrast' },
                    value: observer.get('data.ambient.ambientBakeOcclusionContrast'),
                    min: -1,
                    max: 1,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'brightness' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.ambient.ambientBakeOcclusionBrightness' },
                    value: observer.get('data.ambient.ambientBakeOcclusionBrightness'),
                    min: -1,
                    max: 1,
                    precision: 1
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Directional light' },
            jsx(
                LabelGroup,
                { text: 'enable' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.directional.enabled' },
                    value: observer.get('data.directional.enabled')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'bake' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.directional.bake' },
                    value: observer.get('data.directional.bake')
                })
            ),
            jsx(
                LabelGroup,
                { text: 'samples' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.directional.bakeNumSamples' },
                    value: observer.get('data.directional.bakeNumSamples'),
                    max: 64,
                    precision: 0
                })
            ),
            jsx(
                LabelGroup,
                { text: 'area' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.directional.bakeArea' },
                    value: observer.get('data.directional.bakeArea'),
                    max: 40,
                    precision: 0
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Other lights' },
            jsx(
                LabelGroup,
                { text: 'enable' },
                jsx(BooleanInput, {
                    type: 'toggle',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.other.enabled' },
                    value: observer.get('data.other.enabled')
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Bake stats' },
            jsx(
                LabelGroup,
                { text: 'duration' },
                jsx(Label, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'data.stats.duration' },
                    value: observer.get('data.stats.duration')
                })
            )
        )
    );
}
