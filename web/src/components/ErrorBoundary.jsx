import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    // TODO: send to logging service
    // console.error('ErrorBoundary caught', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Ocorreu um erro na aplicação</h2>
          <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{String(this.state.error && this.state.error.toString())}</div>
          {this.state.info && <details style={{ marginTop: 12 }}><summary>Detalhes</summary><pre>{this.state.info.componentStack}</pre></details>}
        </div>
      );
    }

    return this.props.children;
  }
}
