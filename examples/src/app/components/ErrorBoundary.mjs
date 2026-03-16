import { Label } from '@playcanvas/pcui/react';
import { Component } from 'react';

import { jsx } from '../jsx.mjs';


/**
 * @typedef {object} Props
 * @property {import('react').ReactNode} children - The children.
 */

/**
 * @typedef {object} State
 * @property {boolean} hasError - Has an error.
 */

/** @type {typeof Component<Props, State>} */
const TypedComponent = Component;

class ErrorBoundary extends TypedComponent {
    /**
     * @param {any} props - The properties.
     */
    constructor(props) {
        super(props);
        this.state = { hasError: false };

        this._handleReset = this._handleReset.bind(this);
    }

    /**
     * @returns {object} - The state.
     */
    static getDerivedStateFromError() {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    _parseErrorLocations(stack) {
        const lines = stack.split('\n');
        const locations = [];
        lines.forEach((line) => {
            const match = /\((.+):(\d+):(\d+)\)$/.exec(line);
            if (!match) {
                return;
            }
            locations.push({
                file: match[1],
                line: +match[2],
                column: +match[3]
            });
        });
        return locations;
    }

    _handleReset() {
        this.setState({ hasError: false });
    }

    componentDidMount() {
        window.addEventListener('resetErrorBoundary', this._handleReset);
    }

    componentWillUnmount() {
        window.removeEventListener('resetErrorBoundary', this._handleReset);
    }

    /**
     * @param {Error} error - The error.
     * @param {any} info - The error info.
     */
    componentDidCatch(error, info) {
        console.error(error, info);
        const locations = this._parseErrorLocations(error.stack);
        window.dispatchEvent(new CustomEvent('exampleError', {
            detail: {
                name: error.constructor.name,
                message: error.message,
                locations
            }
        }));
    }

    render() {
        if (this.state.hasError) {
            return jsx(Label, {
                id: 'errorLabel',
                text: 'RENDER FAILED'
            });
        }
        return this.props.children;
    }
}
export { ErrorBoundary };
