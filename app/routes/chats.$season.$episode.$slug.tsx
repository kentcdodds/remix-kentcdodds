import React, {useState} from 'react'
import {useRouteData, json} from 'remix'
import type {HeadersFunction} from 'remix'
import {Link} from 'react-router-dom'
import type {KCDLoader, CWKEpisode, CWKListItem} from 'types'
import clsx from 'clsx'
import {motion} from 'framer-motion'
import {getSeasons, refreshSeasons} from '../utils/simplecast.server'
import {H2, H3, H6, Paragraph} from '../components/typography'
import {Grid} from '../components/grid'
import {ArrowIcon} from '../components/icons/arrow-icon'
import {ClipboardIcon} from '../components/icons/clipboard-icon'
import {CheckCircledIcon} from '../components/icons/check-circled-icon'
import {GithubIcon} from '../components/icons/github-icon'
import {TwitterIcon} from '../components/icons/twitter-icon'
import {PlusIcon} from '../components/icons/plus-icon'
import {FeaturedSection} from '../components/sections/featured-section'
import {ArrowLink, BackLink} from '../components/arrow-button'
import {ChevronRightIcon} from '../components/icons/chevron-right-icon'
import {ChevronLeftIcon} from '../components/icons/chevron-left-icon'
import {formatTime, listify} from '../utils/misc'
import {getCWKEpisodePath, getFeaturedEpisode} from '../utils/chats-with-kent'
import {getUser} from '../utils/session.server'

type LoaderData = {
  prevEpisode: CWKListItem | null
  nextEpisode: CWKListItem | null
  featured: CWKListItem | null
  episode: CWKEpisode
}

export const loader: KCDLoader<{
  slug: string
  season: string
  episode: string
}> = async ({request, params}) => {
  if (new URL(request.url).searchParams.has('fresh')) {
    const user = await getUser(request)
    if (user?.role === 'ADMIN') {
      await refreshSeasons()
    }
  }

  const episodeNumber = Number(params.episode)
  const seasonNumber = Number(params.season)

  const seasons = await getSeasons()
  const season = seasons.find(s => s.seasonNumber === seasonNumber)
  if (!season) {
    throw new Error(`oh no. season for season number: ${params.season}`)
  }
  const episode = season.episodes.find(e => e.episodeNumber === episodeNumber)
  if (!episode) {
    throw new Error(
      `oh no. no episode for ${params.season}/${params.episode}/${params.slug}`,
    )
  }

  const data: LoaderData = {
    prevEpisode:
      season.episodes.find(e => e.episodeNumber === episodeNumber - 1) ?? null,
    nextEpisode:
      season.episodes.find(e => e.episodeNumber === episodeNumber + 1) ?? null,
    featured: getFeaturedEpisode(season.episodes.filter(e => episode !== e)),
    episode,
  }

  // TODO: add 404 handling
  return json(data, {
    headers: {
      'Cache-Control': 'public, max-age=600',
    },
  })
}

export const headers: HeadersFunction = ({loaderHeaders}) => {
  return {
    'Cache-Control': loaderHeaders.get('Cache-Control') ?? 'no-cache',
  }
}

function Homework({
  homeworkHTMLs = [],
}: {
  homeworkHTMLs: CWKEpisode['homeworkHTMLs']
}) {
  return (
    <div className="bg-secondary p-10 pb-16 w-full rounded-lg">
      <H6 as="h4" className="inline-flex items-center mb-8 space-x-4">
        <ClipboardIcon />
        <span>Homework</span>
      </H6>

      <ul className="text-primary">
        {homeworkHTMLs.map(homeworkHTML => (
          <li
            key={homeworkHTML}
            className="flex pb-12 pt-8 border-t border-gray-200 dark:border-gray-600"
          >
            <CheckCircledIcon
              className="flex-none mr-6 text-gray-400 dark:text-gray-600"
              size={24}
            />

            <div
              className="text-lg font-medium"
              dangerouslySetInnerHTML={{__html: homeworkHTML}}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Resources({resources = []}: {resources: CWKEpisode['resources']}) {
  return (
    <div className="bg-secondary p-10 pb-16 rounded-lg">
      <h4 className="text-primary inline-flex items-center mb-8 text-xl font-medium">
        Resources
      </h4>

      <ul className="text-primary space-y-8">
        {resources.map(resource => (
          <li key={resource.url}>
            <a href={resource.url} className="text-secondary text-xl space-x-4">
              <span>{resource.name}</span>
              <span className="inline-block align-bottom">
                <ArrowIcon direction="top-right" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Guests({episode}: {episode: CWKEpisode}) {
  return (
    <>
      <h4 className="sr-only">Guests</h4>

      {episode.guests.map(guest => (
        <div
          key={guest.name}
          className="text-secondary bg-secondary flex flex-col p-10 pb-16 rounded-lg md:flex-row md:items-center md:pb-12"
        >
          <img
            src={episode.image}
            alt={guest.name}
            className="flex-none mb-6 mr-8 w-20 h-20 rounded-lg object-cover md:mb-0"
          />
          <div className="mb-6 w-full md:flex-auto md:mb-0">
            <div className="text-primary mb-2 text-xl font-medium leading-none">
              {guest.name}
            </div>
            <p className="text-xl leading-none">{guest.company}</p>
          </div>
          <div className="flex flex-none space-x-4">
            {guest.twitter ? (
              <a href={guest.twitter} aria-label="twitter profile">
                <TwitterIcon />
              </a>
            ) : null}

            {guest.github ? (
              <a href={guest.github} aria-label="github profile">
                <GithubIcon />
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </>
  )
}

function Transcript({
  transcriptHTML,
}: {
  transcriptHTML: CWKEpisode['transcriptHTML']
}) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <div className="bg-secondary col-span-full p-10 pb-16 rounded-lg">
      <h4 className="text-primary inline-flex items-center mb-8 text-xl font-medium">
        Transcript
      </h4>

      <div
        className={clsx(
          'prose prose-light dark:prose-dark relative overflow-hidden',
          {
            'max-h-96': collapsed,
          },
        )}
      >
        <div dangerouslySetInnerHTML={{__html: transcriptHTML}} />

        {collapsed ? (
          <div className="absolute bottom-0 w-full h-48 bg-gradient-to-b from-transparent to-gray-100 dark:to-gray-800" />
        ) : null}
      </div>
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="text-primary inline-flex items-center mt-16 text-xl transition"
        >
          <span>Read the full transcript</span>
          <span className="inline-flex flex-none items-center justify-center ml-8 p-1 w-14 h-14 border-2 border-gray-200 dark:border-gray-600 rounded-full">
            <PlusIcon />
          </span>
        </button>
      ) : null}
    </div>
  )
}

const imageVariants = {
  initial: {
    opacity: 1,
  },
  hover: {
    opacity: 0.2,
  },
}
const arrowVariants = {
  initial: {
    opacity: 0,
  },
  hover: {
    scale: 2,
    opacity: 1,
  },
  tapLeft: {
    x: -5,
    opacity: 0,
  },
  tapRight: {
    x: 5,
    opacity: 1,
  },
}

const MotionLink = motion(Link)

function PrevNextButton({
  episodeListItem,
  direction,
}: {
  episodeListItem?: CWKListItem | null
  direction: 'prev' | 'next'
}) {
  if (!episodeListItem) {
    return <div /> // return empty div for easy alignment
  }

  return (
    <MotionLink
      initial="initial"
      whileHover="hover"
      whileFocus="hover"
      whileTap={direction === 'next' ? 'tapRight' : 'tapLeft'}
      animate="initial"
      to={getCWKEpisodePath(episodeListItem)}
      className={clsx('flex items-center focus:outline-none', {
        'flex-row-reverse': direction === 'next',
      })}
    >
      <div className="relative rounded-lg overflow-hidden">
        <motion.img
          variants={imageVariants}
          transition={{duration: 0.2}}
          className="w-12 h-12"
          src={episodeListItem.image}
          alt={episodeListItem.title}
        />
        <motion.div
          variants={arrowVariants}
          className="text-primary absolute inset-0 flex items-center justify-center origin-center"
        >
          {direction === 'next' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </motion.div>
      </div>
      <div
        className={clsx('flex flex-col', {
          'ml-4 items-start': direction === 'prev',
          'mr-4 items-end text-right': direction === 'next',
        })}
      >
        <p className="text-primary text-lg font-medium">
          {episodeListItem.guests[0]?.name}
        </p>
        <h6 className="text-secondary text-lg font-medium">
          {episodeListItem.title}
        </h6>
      </div>
    </MotionLink>
  )
}

function PodcastDetail() {
  const {episode, featured, nextEpisode, prevEpisode} =
    useRouteData<LoaderData>()

  return (
    <>
      <Grid className="mb-10 mt-24 lg:mb-24">
        <BackLink
          to="/chats"
          className="lg-col-span-8 col-span-full lg:col-start-3"
        >
          Back to overview
        </BackLink>
      </Grid>

      <Grid as="header" className="mb-12">
        <H2 className="col-span-full lg:col-span-8 lg:col-start-3">
          {episode.title}
        </H2>
      </Grid>

      <Grid as="main" className="mb-24 lg:mb-96">
        <div className="col-span-full mb-16 lg:col-span-8 lg:col-start-3">
          <iframe
            className="mb-4"
            title="player"
            height="200px"
            width="100%"
            frameBorder="no"
            scrolling="no"
            seamless
            src={`https://player.simplecast.com/${episode.simpleCastId}?dark=false`}
          />

          <div className="flex justify-between">
            <PrevNextButton episodeListItem={prevEpisode} direction="prev" />
            <PrevNextButton episodeListItem={nextEpisode} direction="next" />
          </div>
        </div>

        <H3
          className="col-span-full mb-6 lg:col-span-8 lg:col-start-3"
          dangerouslySetInnerHTML={{__html: episode.descriptionHTML}}
        />

        <Paragraph
          as="div"
          className="col-span-full mb-10 space-y-6 lg:col-span-8 lg:col-start-3"
          dangerouslySetInnerHTML={{__html: episode.summaryHTML}}
        />

        <div className="col-span-full space-y-4 lg:col-span-8 lg:col-start-3">
          {episode.homeworkHTMLs.length > 0 ? (
            <Homework homeworkHTMLs={episode.homeworkHTMLs} />
          ) : null}
          {episode.resources.length > 0 ? (
            <Resources resources={episode.resources} />
          ) : null}
          <Guests episode={episode} />
          {episode.transcriptHTML ? (
            <Transcript transcriptHTML={episode.transcriptHTML} />
          ) : null}
        </div>
      </Grid>

      <Grid>
        <div className="flex flex-col col-span-full mb-20 space-y-10 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div className="space-y-2 lg:space-y-0">
            <H2>Sweet episode right?</H2>
            <H2 variant="secondary" as="p">
              You will love this one too.{' '}
            </H2>
          </div>

          <ArrowLink to="/chats" direction="right">
            See all episodes
          </ArrowLink>
        </div>
      </Grid>

      {featured ? (
        <FeaturedSection
          cta="Listen to this episode"
          caption="Featured episode"
          subTitle={`Season ${featured.seasonNumber} Episode ${
            featured.episodeNumber
          } — ${formatTime(featured.duration)}`}
          title={featured.title}
          href={getCWKEpisodePath(featured)}
          imageUrl={featured.image}
          imageAlt={listify(featured.guests.map(g => g.name))}
        />
      ) : null}
    </>
  )
}

export default PodcastDetail
