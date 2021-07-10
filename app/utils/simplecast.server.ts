import type {CWKEpisode} from 'types'
import unified from 'unified'
import parseHtml from 'rehype-parse'
import parseMarkdown from 'remark-parse'
import remark2rehype from 'remark-rehype'
import rehype2remark from 'rehype-remark'
import rehypeStringify from 'rehype-stringify'
import mdastToHast from 'mdast-util-to-hast'
import hastToHtml from 'hast-util-to-html'
import type * as U from 'unist'
import type * as M from 'mdast'
import visit from 'unist-util-visit'
import {getRequiredServerEnvVar} from './misc'
import {markdownToHtml} from './markdown.server'

// TODO: add redis caching?

const SIMPLECAST_KEY = getRequiredServerEnvVar('SIMPLECAST_KEY')
const CHATS_WITH_KENT_PODCAST_ID = getRequiredServerEnvVar(
  'CHATS_WITH_KENT_PODCAST_ID',
)

const headers = {
  authorization: `Bearer ${SIMPLECAST_KEY}`,
}

async function getSeasons() {
  const res = await fetch(
    `https://api.simplecast.com/podcasts/${CHATS_WITH_KENT_PODCAST_ID}/seasons`,
    {headers},
  )
  const {collection} = (await res.json()) as {
    collection: Array<{href: string; number: number}>
  }

  return Promise.all(
    collection.map(async ({href, number}) => {
      const seasonId = new URL(href).pathname.split('/').slice(-1)[0]
      if (!seasonId) {
        throw new Error(
          `Could not determine seasonId from ${href} for season ${number}`,
        )
      }
      return {seasonNumber: number, episodes: await getEpisodes(seasonId)}
    }),
  )
}

type SimplcastEpisode = {
  is_hidden: boolean
  id: string
  duration: number
  number: number
  transcription: string
  status: 'draft' | 'published'
  is_published: boolean
  image_url: string
  audio_file_url: string
  slug: string
  description: string
  season: {
    href: string
    number: number
  }
  long_description: string
  title: string
  keywords: {
    href: string
    collection: Array<{
      value: string
    }>
  }
}

type SimplecastEpisodeListItem = Pick<
  SimplcastEpisode,
  'status' | 'is_hidden' | 'id'
>

async function getEpisodes(seasonId: string) {
  const url = new URL(`https://api.simplecast.com/seasons/${seasonId}/episodes`)
  url.searchParams.set('limit', '300')
  const res = await fetch(url.toString(), {headers})
  const {collection} = (await res.json()) as {
    collection: Array<SimplecastEpisodeListItem>
  }
  return Promise.all(
    collection
      .filter(({status, is_hidden}) => status === 'published' && !is_hidden)
      .map(({id}) => getEpisode(id)),
  )
}

async function getEpisode(episodeId: string) {
  const res = await fetch(`https://api.simplecast.com/episodes/${episodeId}`, {
    headers,
  })
  const {
    slug,
    transcription: transcriptMarkdown,
    long_description: summaryMarkdown,
    description: descriptionMarkdown,
    image_url,
    number,
    duration,
    title,
    season: {number: seasonNumber},
    keywords: keywordsData,
  } = (await res.json()) as SimplcastEpisode

  const keywords = keywordsData.collection.map(({value}) => value)
  const [
    transcriptHTML,
    descriptionHTML,
    {summaryHTML, homeworkHTMLs, resources, guests},
  ] = await Promise.all([
    markdownToHtml(transcriptMarkdown),
    markdownToHtml(descriptionMarkdown),
    parseSummaryMarkdown(summaryMarkdown),
  ])

  const cwkEpisode: CWKEpisode = {
    transcriptHTML,
    descriptionHTML,
    summaryHTML,
    guests,
    slug,
    resources,
    image: image_url,
    episodeNumber: number,
    homeworkHTMLs,
    seasonNumber,
    duration,
    title,
    meta: {
      keywords,
    },
    simpleCastId: episodeId,
  }
  return cwkEpisode
}

function removeEls<ItemType>(array: Array<ItemType>, ...els: Array<ItemType>) {
  return array.filter(el => !els.includes(el))
}

async function parseSummaryMarkdown(
  summaryInput: string,
): Promise<
  Pick<CWKEpisode, 'summaryHTML' | 'resources' | 'guests' | 'homeworkHTMLs'>
> {
  // TODO: remark to get stuff out of the description

  const isHTMLInput = summaryInput.trim().startsWith('<')
  const resources: CWKEpisode['resources'] = []
  const guests: CWKEpisode['guests'] = []
  const homeworkHTMLs: CWKEpisode['homeworkHTMLs'] = []

  const {contents} = await unified()
    .use(isHTMLInput ? parseHtml : parseMarkdown)
    .use(isHTMLInput ? rehype2remark : () => {})
    .use(function extractMetaData() {
      return function transformer(treeArg) {
        if (treeArg.type !== 'root') {
          throw new Error(
            `summary markdown root element is a ${treeArg.type} not a "root".`,
          )
        }
        const tree = treeArg as M.Root
        type Section = {
          children: Array<U.Node>
          remove: () => void
        }
        const sections: Record<string, Section> = {}
        visit(tree, 'heading', (heading: M.Heading, index, parent) => {
          if (!parent) throw new Error('heading without a parent')
          if (heading.depth !== 3) return

          const nextHeading = parent.children
            .slice(index + 1)
            .find(n => n.type === 'heading' && (n as M.Heading).depth >= 3)
          const endOfSection = nextHeading
            ? parent.children.indexOf(nextHeading)
            : parent.children.length

          const headingChildren = parent.children.slice(index + 1, endOfSection)
          const sectionTitle = (heading.children[0] as M.Text | undefined)
            ?.value
          if (!sectionTitle) throw new Error('Section with no title')
          sections[sectionTitle] = {
            children: headingChildren,
            remove() {
              parent.children = removeEls(
                parent.children,
                heading,
                ...headingChildren,
              )
            },
          }
        })

        for (const [sectionTitle, {children, remove}] of Object.entries(
          sections,
        )) {
          // can't remove elements from an array while you're iterating
          // over that array, so we have to do it afterwards

          if (/kent c. dodds/i.test(sectionTitle)) {
            // we don't need to add any meta data for Kent.
            remove()
            continue
          }
          if (/resources/i.test(sectionTitle)) {
            remove()
            for (const child of children) {
              visit(child, 'listItem', (listItem: M.ListItem) => {
                visit(listItem, 'link', (link: M.Link) => {
                  visit(link, 'text', (text: M.Text) => {
                    resources.push({
                      name: text.value,
                      url: link.url,
                    })
                  })
                })
              })
            }
          }
          if (/homework/i.test(sectionTitle)) {
            remove()
            for (const child of children) {
              visit(child, 'listItem', (listItem: M.ListItem) => {
                homeworkHTMLs.push(
                  listItem.children
                    .map(c => hastToHtml(mdastToHast(c)))
                    .join(''),
                )
              })
            }
          }
          if (/^guest/i.test(sectionTitle)) {
            remove()
            for (const child of children) {
              let company, github, twitter
              visit(child, 'listItem', (listItem: M.ListItem) => {
                // this error handling makes me laugh and cry
                // definitely better error messages than we'd get
                // if we just pretended this could never happen...
                const paragraph = listItem.children[0]
                if (paragraph?.type !== 'paragraph') {
                  throw new Error(
                    'guest listItem first child is not a paragraph',
                  )
                }
                const [text, link] = paragraph.children
                if (text?.type !== 'text') {
                  console.error(paragraph)
                  throw new Error(
                    `guest listItem first child's first child is not a text node`,
                  )
                }
                if (link?.type !== 'link') {
                  console.error(paragraph)
                  throw new Error(
                    `guest listItem first child's second child is not a link node`,
                  )
                }
                const linkText = link.children[0]
                if (linkText?.type !== 'text') {
                  console.error(link)
                  throw new Error(
                    `guest listItem first child's second child's first child is not a text node`,
                  )
                }
                const {value: type} = text
                const {value: name} = linkText
                if (/company/i.test(type)) {
                  company = name
                }
                if (/github/i.test(type)) {
                  github = name.replace('@', '')
                }
                if (/twitter/i.test(type)) {
                  twitter = name.replace('@', '')
                }
              })
              guests.push({
                name: sectionTitle.replace(/^guest:?/i, '').trim(),
                company,
                github,
                twitter,
              })
            }
          }
        }

        const [lastElement] = tree.children.slice(-1)
        if (lastElement?.type === 'thematicBreak') {
          tree.children = removeEls(tree.children, lastElement)
        }
      }
    })
    .use(remark2rehype)
    .use(rehypeStringify)
    .process(summaryInput)

  const summaryHTML = contents.toString()
  return {
    summaryHTML,
    homeworkHTMLs,
    resources,
    guests,
  }
}

export {getSeasons}
