import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { IssuesPanel } from './IssuesPanel'
import { useIssuesStore } from '../store/issues-store'
import type {
  CreateIssueResult,
  GithubAuthSource,
  IssuesPanelData
} from '@shared/ipc/api-contract'

const getIssues = vi.fn(async () => panelData())
const createIssue = vi.fn<() => Promise<CreateIssueResult>>()
const openExternal = vi.fn(async () => {})
const githubSignIn = vi.fn()
const githubSignOut = vi.fn()

function panelData(over: Partial<IssuesPanelData> = {}): IssuesPanelData {
  return {
    repo: { owner: 'octo', repo: 'hello' },
    issues: [
      {
        number: 1,
        title: 'Existing',
        state: 'open',
        author: 'alice',
        labels: [{ name: 'bug', color: 'd73a4a' }],
        comments: 0,
        htmlUrl: 'https://github.com/octo/hello/issues/1',
        updatedAt: ''
      }
    ],
    authSource: 'gh',
    fetchedAt: '',
    stale: false,
    error: null,
    ...over
  }
}

function seed(authSource: GithubAuthSource = 'gh'): void {
  useIssuesStore.setState({ panel: panelData({ authSource }), signIn: null, authError: null })
}

beforeEach(() => {
  getIssues.mockClear()
  createIssue.mockReset()
  openExternal.mockClear()
  Object.defineProperty(window, 'api', {
    value: { getIssues, createIssue, openExternal, githubSignIn, githubSignOut },
    configurable: true
  })
})

afterEach(cleanup)

describe('IssuesPanel — create issue', () => {
  it('disables the New issue button when unauthenticated', () => {
    seed('none')
    render(<IssuesPanel cwd="C:/repo" />)
    const btn = screen.getByTestId('issues-new') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('opens the form and creates an issue, opening it in the browser', async () => {
    seed('gh')
    createIssue.mockResolvedValueOnce({
      issue: panelData().issues[0]!
    })
    // The refresh() after create pulls a fresh panel.
    getIssues.mockResolvedValueOnce(panelData())

    render(<IssuesPanel cwd="C:/repo" />)
    fireEvent.click(screen.getByTestId('issues-new'))

    fireEvent.change(screen.getByTestId('issue-form-title'), {
      target: { value: 'New bug' }
    })
    fireEvent.change(screen.getByTestId('issue-form-body'), {
      target: { value: 'boom' }
    })
    // Toggle the "bug" label chip on.
    fireEvent.click(screen.getByRole('button', { name: 'bug' }))
    fireEvent.click(screen.getByTestId('issue-form-submit'))

    await waitFor(() =>
      expect(createIssue).toHaveBeenCalledWith('C:/repo', {
        title: 'New bug',
        body: 'boom',
        labels: ['bug']
      })
    )
    await waitFor(() =>
      expect(openExternal).toHaveBeenCalledWith('https://github.com/octo/hello/issues/1')
    )
    // Form closes on success.
    await waitFor(() => expect(screen.queryByTestId('issue-form')).toBeNull())
  })

  it('keeps the form open and shows the error when creation fails', async () => {
    seed('gh')
    createIssue.mockResolvedValueOnce({ error: 'Repository not found.' })

    render(<IssuesPanel cwd="C:/repo" />)
    fireEvent.click(screen.getByTestId('issues-new'))
    fireEvent.change(screen.getByTestId('issue-form-title'), {
      target: { value: 'Boom' }
    })
    fireEvent.click(screen.getByTestId('issue-form-submit'))

    await waitFor(() =>
      expect(screen.getByTestId('issue-form-error').textContent).toContain('Repository not found.')
    )
    expect(openExternal).not.toHaveBeenCalled()
    expect(screen.getByTestId('issue-form')).toBeDefined()
  })

  it('disables submit while the title is blank', () => {
    seed('gh')
    render(<IssuesPanel cwd="C:/repo" />)
    fireEvent.click(screen.getByTestId('issues-new'))
    const submit = screen.getByTestId('issue-form-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.change(screen.getByTestId('issue-form-title'), { target: { value: 'x' } })
    expect(submit.disabled).toBe(false)
  })
})
