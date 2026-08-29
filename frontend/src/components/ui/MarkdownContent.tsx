import type { ReactNode } from 'react'

interface MarkdownContentProps {
  content: string
  className?: string
}

/**
 * Small, safe Markdown renderer for model output. It intentionally renders
 * text as React nodes instead of injecting model-generated HTML.
 */
function inline(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
  return tokens.filter(Boolean).map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={index} className="font-semibold text-slate-100">{token.slice(2, -2)}</strong>
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={index} className="rounded bg-ink/70 px-1 py-0.5 font-mono text-[0.9em] text-signal">{token.slice(1, -1)}</code>
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={index}>{token.slice(1, -1)}</em>
    }
    return token
  })
}

function normalise(content: string) {
  // Qwen occasionally emits consecutive bullets on one line. Split the safe,
  // common "- **Title**" form into proper Markdown list items.
  return content.replace(/\s+- (?=\*\*[^*]+\*\*:)/g, '\n- ').trim()
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  const lines = normalise(content).split('\n')
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let code: string[] | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    blocks.push(
      <p key={`p-${blocks.length}`} className="whitespace-pre-wrap leading-6 text-slate-300">
        {inline(paragraph.join('\n'))}
      </p>,
    )
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={`list-${blocks.length}`} className={`space-y-1.5 pl-5 leading-6 text-slate-300 ${list.ordered ? 'list-decimal' : 'list-disc'}`}>
        {list.items.map((item, index) => <li key={index}>{inline(item)}</li>)}
      </Tag>,
    )
    list = null
  }
  const flushCode = () => {
    if (!code) return
    blocks.push(
      <pre key={`code-${blocks.length}`} className="overflow-x-auto rounded border border-line bg-ink p-3 font-mono text-[11px] leading-5 text-signal/90"><code>{code.join('\n')}</code></pre>,
    )
    code = null
  }

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (code) flushCode()
      else {
        flushParagraph()
        flushList()
        code = []
      }
      continue
    }
    if (code) {
      code.push(line)
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const size = heading[1].length === 1 ? 'text-base' : 'text-sm'
      blocks.push(<h3 key={`h-${blocks.length}`} className={`${size} font-semibold text-slate-100`}>{inline(heading[2])}</h3>)
    } else if (unordered || ordered) {
      flushParagraph()
      const item = (unordered ?? ordered)![1]
      const isOrdered = Boolean(ordered)
      if (!list || list.ordered !== isOrdered) {
        flushList()
        list = { ordered: isOrdered, items: [] }
      }
      list.items.push(item)
    } else if (!line.trim()) {
      flushParagraph()
      flushList()
    } else {
      flushList()
      paragraph.push(line)
    }
  }
  flushParagraph()
  flushList()
  flushCode()

  return <div className={`space-y-3 ${className}`}>{blocks}</div>
}
