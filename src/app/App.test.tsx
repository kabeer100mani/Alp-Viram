import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '@/app/App'

describe('App', () => {
  it('shows the sign-in screen when unauthenticated', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })
})
