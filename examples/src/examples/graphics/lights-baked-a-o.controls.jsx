import {
    BindingTwoWay,
    BooleanInput,
    Label,
    LabelGroup,
    Panel,
    SliderInput
} from '@playcanvas/pcui/react';

/**
 * @import { Observer } from '@playcanvas/observer'
 * @import { ReactElement } from 'react'
 */

/**
 * @param {{ observer: Observer }} props - The control panel props.
 * @returns {ReactElement} The control panel.
 */
export function Controls({ observer }) {
    return (
        <>
            <Panel headerText='Lightmap Filter Settings'>
                <LabelGroup text='enable'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.settings.lightmapFilterEnabled' }}
                        value={observer.get('data.settings.lightmapFilterEnabled')}
                    />
                </LabelGroup>
                <LabelGroup text='range'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.settings.lightmapFilterRange' }}
                        value={observer.get('data.settings.lightmapFilterRange')}
                        min={1}
                        max={20}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='smoothness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.settings.lightmapFilterSmoothness' }}
                        value={observer.get('data.settings.lightmapFilterSmoothness')}
                        min={0.1}
                        max={2}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Ambient light'>
                <LabelGroup text='bake'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ambient.ambientBake' }}
                        value={observer.get('data.ambient.ambientBake')}
                    />
                </LabelGroup>
                <LabelGroup text='cubemap'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ambient.cubemap' }}
                        value={observer.get('data.ambient.cubemap')}
                    />
                </LabelGroup>
                <LabelGroup text='hemisphere'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ambient.hemisphere' }}
                        value={observer.get('data.ambient.hemisphere')}
                    />
                </LabelGroup>
                <LabelGroup text='samples'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ambient.ambientBakeNumSamples' }}
                        value={observer.get('data.ambient.ambientBakeNumSamples')}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='contrast'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ambient.ambientBakeOcclusionContrast' }}
                        value={observer.get('data.ambient.ambientBakeOcclusionContrast')}
                        min={-1}
                        max={1}
                        precision={1}
                    />
                </LabelGroup>
                <LabelGroup text='brightness'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.ambient.ambientBakeOcclusionBrightness' }}
                        value={observer.get('data.ambient.ambientBakeOcclusionBrightness')}
                        min={-1}
                        max={1}
                        precision={1}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Directional light'>
                <LabelGroup text='enable'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.directional.enabled' }}
                        value={observer.get('data.directional.enabled')}
                    />
                </LabelGroup>
                <LabelGroup text='bake'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.directional.bake' }}
                        value={observer.get('data.directional.bake')}
                    />
                </LabelGroup>
                <LabelGroup text='samples'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.directional.bakeNumSamples' }}
                        value={observer.get('data.directional.bakeNumSamples')}
                        max={64}
                        precision={0}
                    />
                </LabelGroup>
                <LabelGroup text='area'>
                    <SliderInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.directional.bakeArea' }}
                        value={observer.get('data.directional.bakeArea')}
                        max={40}
                        precision={0}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Other lights'>
                <LabelGroup text='enable'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.other.enabled' }}
                        value={observer.get('data.other.enabled')}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Bake stats'>
                <LabelGroup text='duration'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.stats.duration' }}
                        value={observer.get('data.stats.duration')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
