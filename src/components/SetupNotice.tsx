import { Link } from 'react-router-dom'

export function SetupNotice({
  title = 'Connect Supabase to unlock rooms',
}: {
  title?: string
}) {
  return (
    <div className="container narrow">
      <div className="panel setup">
        <div className="eyebrow">Setup required</div>
        <h1>{title}</h1>
        <p>
          Solo games work right now. Friends, invites and rooms need a Supabase project:
        </p>
        <ol className="setup-steps">
          <li>Create a project at supabase.com and open its SQL editor.</li>
          <li>
            Run <code>supabase/schema.sql</code> from this folder.
          </li>
          <li>
            Copy <code>.env.example</code> to <code>.env</code> and paste your project URL
            and anon key.
          </li>
          <li>
            Restart the dev server (<code>bun run dev</code>).
          </li>
        </ol>
        <p className="muted">
          For quick testing, turn off “Confirm email” under Authentication → Providers →
          Email in Supabase.
        </p>
        <div className="panel-actions">
          <Link to="/" className="btn btn-primary">
            Back to the arcade
          </Link>
          <Link to="/signin" className="btn btn-ghost">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
