import { Link } from 'react-router-dom'

export function SignInPrompt({ next, message }: { next: string; message?: string }) {
  return (
    <div className="container narrow">
      <div className="panel setup">
        <div className="eyebrow">One step</div>
        <h1>Sign in to play with friends</h1>
        <p>
          {message ??
            'Solo games are always open. Signing in saves your friends and lets you open a room everyone can hop between.'}
        </p>
        <div className="panel-actions">
          <Link to={`/signin?next=${encodeURIComponent(next)}`} className="btn btn-primary">
            Sign in or create an account
          </Link>
          <Link to="/" className="btn btn-ghost">
            Keep playing solo
          </Link>
        </div>
      </div>
    </div>
  )
}
