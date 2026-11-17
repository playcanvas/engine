import {
    BindingTwoWay,
    BooleanInput,
    Label,
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
     * @param {string} text - The label.
     * @param {string} path - The path of the value in the data.
     * @param {number} min - The minimum.
     * @param {number} max - The maximum.
     * @param {number} precision - The number of decimals.
     * @returns {ReactElement} The slider.
     */
    const slider = (text, path, min, max, precision) => (
        <LabelGroup text={text}>
            <SliderInput
                binding={new BindingTwoWay()}
                link={{ observer, path }}
                min={min}
                max={max}
                precision={precision}
            />
        </LabelGroup>
    );

    return (
        <>
            <Panel headerText='Preset'>
                <LabelGroup text='Preset'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.preset' }}
                        type='string'
                        options={[
                            { v: 'windswept', t: 'Windswept' },
                            { v: 'sandstorm', t: 'Sandstorm' },
                            { v: 'dissolve', t: 'Dissolve' },
                            { v: 'burning', t: 'Burning' },
                            { v: 'debris', t: 'Debris (brush)' },
                            { v: 'sand', t: 'Sand (brush)' },
                            { v: 'shatter', t: 'Shatter (click)' },
                            { v: 'bouncy', t: 'Bouncy (brush)' },
                            { v: 'zeroGravity', t: 'Zero Gravity (brush)' },
                            { v: 'sparks', t: 'Sparks (brush)' },
                            { v: 'embers', t: 'Embers (brush)' },
                            { v: 'lava', t: 'Lava (brush)' }
                        ]}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Brush' collapsible collapsed>
                <LabelGroup text='Mode'>
                    <SelectInput
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.mode' }}
                        type='string'
                        options={[
                            { v: 'stream', t: 'Stream (hold)' },
                            { v: 'burst', t: 'Burst (click)' },
                            { v: 'wander', t: 'Wander (automatic)' },
                            { v: 'screen', t: 'Whole Screen (automatic)' }
                        ]}
                    />
                </LabelGroup>
                {slider('Rate (k/s)', 'data.rate', 10, 2000, 0)}
                {slider('Burst (k)', 'data.burst', 10, 500, 0)}
                {slider('Size (px)', 'data.brush', 4, 300, 0)}
                {slider('Speed', 'data.speed', 0, 15, 1)}
                {slider('Spread', 'data.spread', 0, 4, 2)}
                {slider('Particle Size', 'data.size', 0.3, 4, 2)}
                {slider('Life (s)', 'data.life', 0.5, 30, 1)}
            </Panel>
            <Panel headerText='Physics' collapsible collapsed>
                {slider('Gravity', 'data.gravity', -5, 20, 1)}
                {slider('Bounce', 'data.bounce', 0, 1, 2)}
                {slider('Friction', 'data.friction', 0, 1, 2)}
                {slider('Drag', 'data.drag', 0, 3, 2)}
                {slider('Wind', 'data.wind', 0, 12, 1)}
                {slider('Turbulence', 'data.turbulence', 0, 10, 1)}
                {slider('Gravity Well', 'data.well', 0, 100, 0)}
                <LabelGroup text='Camera Collides'>
                    <BooleanInput
                        type='toggle'
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'data.collide' }}
                    />
                </LabelGroup>
            </Panel>
            <Panel headerText='Look' collapsible collapsed>
                {slider('Glow', 'data.glow', 0, 3, 2)}
                {slider('Fire Color', 'data.fire', 0, 1, 2)}
                {slider('Temperature', 'data.temperature', 0, 1, 2)}
                {slider('Cooling', 'data.cooling', 0, 3, 2)}
                {slider('Motion Streak', 'data.streak', 0, 0.05, 3)}
                {slider('Bloom', 'data.bloom', 0, 0.2, 3)}
            </Panel>
            <Panel headerText='Stats' collapsible collapsed>
                <LabelGroup text='Particles'>
                    <Label
                        binding={new BindingTwoWay()}
                        link={{ observer, path: 'stats.particles' }}
                        value={observer.get('stats.particles')}
                    />
                </LabelGroup>
            </Panel>
        </>
    );
}
