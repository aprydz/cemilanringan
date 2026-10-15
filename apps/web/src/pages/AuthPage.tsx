import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { getRequestError } from '../features/products/api'

export default function AuthPage({ mode, adminOnly = false }: { mode: 'login' | 'register'; adminOnly?: boolean }) {
  const registering = mode === 'register'
  const navigate = useNavigate()
  const { user, loading, signIn, signUp, signOut } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loading && user) {
    if (user.role === 'ADMIN') {
      return <Navigate replace to="/admin/dashboard" />
    }
    if (!adminOnly) {
      return <Navigate replace to="/profile" />
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (registering) {
        await signUp({ name, email, password, phone: phone || undefined })
        navigate('/products', { replace: true })
      } else {
        const signedInUser = await signIn({ email, password })
        if (adminOnly && signedInUser.role !== 'ADMIN') {
          await signOut()
          throw new Error('Akun ini tidak memiliki akses admin.')
        }
        navigate(signedInUser.role === 'ADMIN' ? '/admin/dashboard' : '/products', { replace: true })
      }
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message === 'Akun ini tidak memiliki akses admin.'
        ? requestError.message
        : getRequestError(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-form-wrap">
        <p className="eyebrow">AKUN TOKO</p>
        <h1>{registering ? 'Buat akun' : 'Selamat datang kembali.'}</h1>
        <p className="auth-intro">{registering ? 'Simpan alamat dan pantau pesananmu dengan mudah.' : 'Masuk untuk melihat akun dan pesananmu.'}</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {registering && <label>Nama lengkap<input autoComplete="name" maxLength={120} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} /></label>}
          <label>Email<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          {registering && <label>Nomor telepon <span className="optional-label">Opsional</span><input autoComplete="tel" maxLength={30} onChange={(event) => setPhone(event.target.value)} type="tel" value={phone} /></label>}
          <label>Kata sandi {registering && <span className="optional-label" style={{ fontWeight: 400, color: 'var(--muted)' }}>(min. 6 karakter)</span>}<input autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 6 : undefined} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button-primary auth-submit" disabled={submitting} type="submit">{submitting ? 'Memproses...' : registering ? 'Buat akun' : 'Masuk'} <ArrowRight size={16} /></button>
        </form>
        <p className="auth-switch">{registering ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}<Link to={registering ? '/login' : '/register'}>{registering ? 'Masuk' : 'Daftar'}</Link></p>
      </div>
      <div className="auth-aside"><span className="auth-stamp">ps</span><p>Teman ngemilmu, selalu dekat.</p></div>
    </section>
  )
}