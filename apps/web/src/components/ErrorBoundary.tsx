import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; message: string | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Unexpected error' }
  }

  componentDidCatch(error: unknown) {
    console.error('UI crash captured by ErrorBoundary', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="message-page" role="alert">
        <p className="eyebrow">TERJADI KESALAHAN</p>
        <h1>Yah, ada yang tidak beres.</h1>
        <p className="auth-error" style={{ marginTop: 8 }}>{this.state.message}</p>
        <button className="button-primary" onClick={() => window.location.reload()} type="button">Muat ulang</button>
      </main>
    )
  }
}
