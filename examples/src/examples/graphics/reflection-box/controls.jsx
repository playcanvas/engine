import {
    BindingTwoWay,
    BooleanInput,
    LabelGroup,
    Panel,
    SelectInput,
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
    /**
     * @param {string} path - The path of the setting.
     * @returns {ReactElement} The slider.
     */
    const slider = (path) => (
        <SliderInput
            binding={new BindingTwoWay()}
            link={{ observer, path: `settings.${path}` }}
            min={0}
            max={1}
            precision={2}
        />
    );

    /**
     * @param {string} path - The path of the setting.
     * @returns {ReactElement} The toggle.
     */
    const toggle = (path) => (
        <BooleanInput
            type='toggle'
            binding={new BindingTwoWay()}
            link={{ observer, path: `settings.${path}` }}
        />
    );

    return (
        <>
            <Panel headerText='Reflections'>
                <LabelGroup text='Enabled'>{toggle('reflections.enabled')}</LabelGroup>
                <LabelGroup text='Update'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'settings.reflections.updateFrequency' }}
                        type='number'
                        options={[
                            { v: 0, t: 'Once' },
                            { v: 1, t: 'Every frame' },
                            { v: 10, t: 'Every 10 frames' },
                            { v: 30, t: 'Every 30 frames' }
                        ]}
                    />
                </LabelGroup>
                <LabelGroup text='Box Projection'>{toggle('reflections.boxProjection')}</LabelGroup>
                <LabelGroup text='Reflectivity'>{slider('reflections.reflectivity')}</LabelGroup>
                <LabelGroup text='Show Cubemap'>{toggle('reflections.showCubemap')}</LabelGroup>
            </Panel>
            <Panel headerText='Material'>
                <LabelGroup text='Floor Roughness'>{slider('material.floorRoughness')}</LabelGroup>
                <LabelGroup text='Floor Metalness'>{slider('material.floorMetalness')}</LabelGroup>
                <LabelGroup text='Sphere Roughness'>
                    {slider('material.sphereRoughness')}
                </LabelGroup>
                <LabelGroup text='Sphere Metalness'>
                    {slider('material.sphereMetalness')}
                </LabelGroup>
                <LabelGroup text='Sphere Bumpiness'>
                    {slider('material.sphereBumpiness')}
                </LabelGroup>
            </Panel>
            <Panel headerText='Scene'>
                <LabelGroup text='Animate'>{toggle('scene.animate')}</LabelGroup>
            </Panel>
        </>
    );
}
