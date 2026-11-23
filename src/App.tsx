import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LobbyProvider } from './context/LobbyContext'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import Play from './pages/Play'
import LobbyPage from './pages/LobbyPage'
import Friends from './pages/Friends'
import SignIn from './pages/SignIn'

function NotFound() {
  return (
    <div className="container narrow">
      <div className="panel setup">
        <p className="eyebrow">404</p>
        <h1>Wrong turn</h1>
        <p className="muted">That page is not part of the arcade.</p>
        <Link to="/" className="btn btn-primary">
          Back to the arcade
        </Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LobbyProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/play/:slug" element={<Play />} />
              <Route path="/lobby/:code" element={<LobbyPage />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </LobbyProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
