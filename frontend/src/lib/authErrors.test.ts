import { describe, expect, it } from 'vitest'
import { HttpError } from './api'
import { signInErrorMessage, signUpErrorMessage } from './authErrors'

describe('signUpErrorMessage', () => {
  it('surfaces the backend detail for a duplicate account', () => {
    const err = new HttpError('Registration failed', 400, {
      status: 400,
      detail: 'An account with this email already exists. Try signing in instead.',
    })
    expect(signUpErrorMessage(err)).toMatch(/already exists/i)
    expect(signUpErrorMessage(err)).toMatch(/signing in/i)
  })

  it('explains a rate limit instead of asking for a retry', () => {
    const err = new HttpError('Too many requests', 429, { status: 429 })
    expect(signUpErrorMessage(err)).toMatch(/too many sign-up attempts/i)
    expect(signUpErrorMessage(err)).toMatch(/wait/i)
  })

  it('reports an unreachable server for non-HTTP failures', () => {
    expect(signUpErrorMessage(new TypeError('Failed to fetch'))).toMatch(
      /cannot reach the server/i,
    )
  })

  it('falls back to a clear message for unexpected server errors', () => {
    expect(signUpErrorMessage(new HttpError('oops', 500, { status: 500 }))).toMatch(
      /server ran into a problem/i,
    )
  })
})

describe('signInErrorMessage', () => {
  it('does not reveal whether the account exists', () => {
    const err = new HttpError('Invalid credentials', 401, { status: 401 })
    expect(signInErrorMessage(err)).toBe('Incorrect email or password.')
  })

  it('explains a sign-in rate limit', () => {
    const err = new HttpError('Too many requests', 429, { status: 429 })
    expect(signInErrorMessage(err)).toMatch(/too many sign-in attempts/i)
  })

  it('reports an unreachable server', () => {
    expect(signInErrorMessage(new TypeError('Failed to fetch'))).toMatch(
      /cannot reach the server/i,
    )
  })
})
