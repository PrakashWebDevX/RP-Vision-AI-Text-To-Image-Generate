import { useMemo, useState } from 'react'
import axios from 'axios'
import { Sparkles, Repeat2, Copy, Share2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

const lengthOptions = [
  { value: '3min', label: '3 minutes' },
  { value: '5min', label: '5 minutes' },
  { value: '10min', label: '10 minutes' },
]

function App() {
  const [form, setForm] = useState({
    topic: '',
    length: '5min',
    language: 'en',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastPayload, setLastPayload] = useState(null)

  const hasResult = useMemo(() => Boolean(result), [result])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!form.topic.trim()) {
      setError('Please add a topic to get started.')
      return
    }
    setLoading(true)
    const payload = {
      topic: form.topic.trim(),
      length: form.length,
      language: form.language,
    }

    try {
      const { data } = await axios.post(`${API_BASE}/generate`, payload)
      setResult(data)
      setLastPayload(payload)
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ??
          'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = async () => {
    if (!lastPayload) return
    setLoading(true)
    setError('')
    try {
      const { data } = await axios.post(`${API_BASE}/generate`, lastPayload)
      setResult(data)
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ??
          'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCopyAll = async () => {
    if (!result) return
    const text = `Title: ${result.seo_title}

Description:
${result.seo_description}

Hashtags: ${result.hashtags.join(' ')}

Thumbnail Ideas:
${result.thumbnail_text.join('\n')}

Script:
${result.script}`
    try {
      await navigator.clipboard.writeText(text)
      setError('')
    } catch {
      setError('Unable to copy text. Please try manually.')
    }
  }

  const handleShare = () => {
    if (!result) return
    const shareText = `${result.seo_title}\n\n${result.seo_description}`
    if (navigator.share) {
      navigator
        .share({ title: result.seo_title, text: shareText })
        .catch(() => {})
    } else {
      handleCopyAll()
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-20 pt-16 sm:px-6 lg:px-8">
        <header className="space-y-4 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1 text-sm text-slate-300">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            AI YouTube Script Generator
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Generate high-retention YouTube scripts in seconds
          </h1>
          <p className="text-lg text-slate-300">
            Enter a topic, choose the runtime, and get a ready-to-post script
            with SEO assets tailored for English or Tamil creators.
          </p>
        </header>

        <main className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/5 bg-white/5 p-6 shadow-card backdrop-blur">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Input</h2>
              <span className="text-sm text-slate-400">
                1 credit = 1 script
              </span>
            </div>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-slate-300">
                Topic
                <textarea
                  name="topic"
                  value={form.topic}
                  onChange={handleChange}
                  placeholder="e.g. How to grow a faceless YouTube automation channel"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  rows={4}
                  maxLength={200}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-300">
                  Script length
                  <select
                    name="length"
                    value={form.length}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  >
                    {lengthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-300">
                  Language
                  <select
                    name="language"
                    value={form.language}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  >
                    <option value="en">English</option>
                    <option value="ta">Tamil</option>
                  </select>
                </label>
              </div>

              {error && (
                <p className="text-sm font-medium text-rose-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3 text-lg font-semibold text-slate-900 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600"
              >
                {loading ? 'Generating...' : 'Generate Script'}
              </button>
            </form>

            {lastPayload && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={loading}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900/50 py-3 text-base font-medium text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Repeat2 className="h-4 w-4" />
                Regenerate
              </button>
            )}
          </section>

          <section className="rounded-3xl border border-white/5 bg-slate-900/60 p-6">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-white">Output</h2>
              {hasResult && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:border-cyan-400"
                  >
                    <Copy className="h-4 w-4" />
                    Copy All
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:border-cyan-400"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                </div>
              )}
            </div>

            {!hasResult && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-slate-400">
                <p>Outputs will appear here once you generate a script.</p>
              </div>
            )}

            {hasResult && (
              <div className="space-y-6">
                <OutputBlock title="SEO Title" content={result.seo_title} />
                <OutputBlock
                  title="SEO Description"
                  content={result.seo_description}
                />
                <OutputBlock
                  title="Hashtags"
                  content={result.hashtags.join(' ')}
                />
                <OutputBlock
                  title="Thumbnail Ideas"
                  content={result.thumbnail_text.join('\n')}
                />
                <OutputBlock title="Script" content={result.script} />
                <p className="text-sm text-slate-500">
                  Word count: {result.word_count} • Estimated runtime:{' '}
                  {result.estimated_time}
                </p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

function OutputBlock({ title, content }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
        {title}
      </h3>
      <pre className="mt-2 whitespace-pre-wrap text-base text-slate-100">
        {content}
      </pre>
    </div>
  )
}

export default App
