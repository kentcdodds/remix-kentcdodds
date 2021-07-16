import * as React from 'react'
import formatDate from 'date-fns/format'
import parseISO from 'date-fns/parseISO'
import type {MdxListItem} from 'types'
import {H3} from './typography'
import {ClipboardCopyButton} from './clipboard-copy-button'

function ArticleCard({
  readTime,
  slug,
  frontmatter: {
    date = formatDate(new Date(), 'yyyy-MM-ii'),
    title = 'Untitled Post',
    // TODO: add a default banner and alt for unbannered articles
    bannerAlt,
    bannerUrl,
  },
}: MdxListItem) {
  // TODO: fix this. We need to retrieve the origin at the server as well. Add an ROOT_URL env variable? Make full url part of front matter?
  const articleUrl = new URL(
    `/blog/${slug}`,
    typeof location === 'undefined' ? 'http://example.com' : location.origin,
  ).toString()

  return (
    <div className="relative w-full">
      <a
        className="group peer relative block w-full focus:outline-none"
        href={`/blog/${slug}`}
      >
        <div className="aspect-w-3 aspect-h-4 w-full rounded-lg transition group-hover:ring-2 group-focus:ring-2 ring-team-current ring-offset-4 dark:ring-offset-gray-900 ring-offset-white">
          <img
            alt={bannerAlt}
            className="rounded-lg object-cover"
            src={bannerUrl}
          />
        </div>

        <div className="mt-8 text-blueGray-500 text-xl font-medium">
          {formatDate(parseISO(date), 'PPP')} — {readTime?.text ?? 'quick read'}
        </div>
        <H3 as="div" className="mt-4">
          {title}
        </H3>
      </a>

      <ClipboardCopyButton
        value={articleUrl}
        className="absolute left-6 top-6"
      />
    </div>
  )
}

export {ArticleCard}
