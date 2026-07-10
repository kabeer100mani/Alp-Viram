import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '@/app/App'

describe('App', () => {
  it('renders the foundation screen through the full provider tree', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: /welcome to alp-viram/i }),
    ).toBeInTheDocument()
  })
})
