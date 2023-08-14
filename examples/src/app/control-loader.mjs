import { Component } from 'react';
import { fragment, jsx } from './jsx.mjs';
import { controlsObserver } from './example.mjs';
import { Controls } from './controls.mjs';
/**
 * @typedef {object} Props
 * @property {string} path
 * @property {any} files
 */
/**
 * @typedef {object} State
 * @property {boolean} exampleLoaded
 */
/** @type {typeof Component<Props, State>} */
const c = Component;
class ControlLoader extends c {
    /**
     * @param {Props} props 
     */
    constructor(props) {
        super(props);
        this.state = {
            exampleLoaded: false
        };
        window.addEventListener('exampleLoading', () => {
            this.setState({
                exampleLoaded: false
            });
        });
        window.addEventListener('exampleLoad', (event) => {
            this.setState({
                exampleLoaded: true
            });
            const activeDevice = event.deviceType;
            controlsObserver.emit('updateActiveDevice', activeDevice);
        });
    }
    /**
     * @param {Readonly<Props>} prevProps 
     */
    componentDidUpdate(prevProps) {
        if (prevProps.path !== this.props.path) {
            this.setState({
                exampleLoaded: false
            });
        }
    }
    render() {
        return fragment(
            this.state.exampleLoaded && jsx(
                Controls,
                {
                    ...this.props
                }
            )
        );
    }
}
export {
    ControlLoader,
};
