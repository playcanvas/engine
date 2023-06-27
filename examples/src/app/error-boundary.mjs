import { Component } from "react";
import { jsx } from "../examples/animation/jsx.mjs";
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    //logErrorToMyService(error, errorInfo);
    console.warn(error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      //return <h1>Something went wrong.</h1>;
      return jsx("h1", null, "Something went wrong.");
    }
    return this.props.children; 
  }
}
export {
    ErrorBoundary
};
