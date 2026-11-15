import { HttpError } from './api'

const NETWORK_MESSAGE =
  'Cannot reach the server. Check your connection and that the service is available, then try again.'

/** Treat anything that looks like an HTTP error as one, even across bundles. */
function asHttpError(err: unknown): HttpError | null {
  if (err instanceof HttpError) return err
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: unknown }).status
    if (typeof status === 'number') return err as HttpError
  }
  return null
}

export function signUpErrorMessage(err: unknown): string {
  const http = asHttpError(err)
  if (!http) return NETWORK_MESSAGE
  switch (http.status) {
    case 400:
      return (
        http.problem?.detail ||
        'An account with this email may already exist. Try signing in instead.'
      )
    case 403:
      return 'Sign-up is not allowed from this device right now.'
    case 409:
      return 'An account with this email already exists. Try signing in instead.'
    case 422:
      return 'Please check your name, email and password, then try again.'
    case 429:
      return 'Too many sign-up attempts. Please wait about a minute, then try again.'
    default:
      if (http.status >= 500) {
        return 'The server ran into a problem. Please try again in a moment.'
      }
      return http.problem?.detail || 'Sign-up failed. Please try again.'
  }
}

export function signInErrorMessage(err: unknown): string {
  const http = asHttpError(err)
  if (!http) return NETWORK_MESSAGE
  switch (http.status) {
    case 401:
      return 'Incorrect email or password.'
    case 429:
      return 'Too many sign-in attempts. Please wait about a minute, then try again.'
    default:
      if (http.status >= 500) {
        return 'The server ran into a problem. Please try again in a moment.'
      }
      return http.problem?.detail || 'Sign-in failed. Please try again.'
  }
}
