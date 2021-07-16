import * as React from 'react'
import type {ActionFunction, LoaderFunction} from 'remix'
import {Form, json, redirect, useRouteData} from 'remix'
import clsx from 'clsx'
import {useEffect, useState} from 'react'
import {getQrCodeDataURL} from '../utils/qrcode.server'
import {getDiscordAuthorizeURL, getDomainUrl} from '../utils/misc'
import {useRequestInfo, useUser, useUserInfo} from '../utils/providers'
import {getMagicLink, updateUser} from '../utils/prisma.server'
import {requireUser, rootStorage, signOutSession} from '../utils/session.server'
import {H2, H6} from '../components/typography'
import {Grid} from '../components/grid'
import {Input, Label} from '../components/form-elements'
import {Button} from '../components/button'
import {CheckCircledIcon} from '../components/icons/check-circled-icon'
import {LogoutIcon} from '../components/icons/logout-icon'
import {TEAM_MAP} from '../utils/onboarding'
import {EyeIcon} from '../components/icons/eye-icon'

type LoaderData = {message?: string; qrLoginCode: string}
export const loader: LoaderFunction = ({request}) => {
  return requireUser(request, async user => {
    const session = await rootStorage.getSession(request.headers.get('Cookie'))
    const message = session.get('message')
    const cookie = await rootStorage.commitSession(session)

    const qrLoginCode = await getQrCodeDataURL(
      getMagicLink({
        emailAddress: user.email,
        domainUrl: getDomainUrl(request),
        validationRequired: false,
        // make a very short expiration time because it should be scanned
        // right away anyway.
        // TODO: make sure that it's generated on-demand rather than as
        // part of the page initial request.
        expirationDate: new Date(Date.now() + 1000 * 30).toISOString(),
      }),
    )
    const loaderData: LoaderData = {message, qrLoginCode}
    return json(loaderData, {headers: {'Set-Cookie': cookie}})
  })
}

const actionIds = {
  changeDetails: 'change details',
  logout: 'logout',
}

export const action: ActionFunction = async ({request}) => {
  return requireUser(request, async user => {
    const session = await rootStorage.getSession(request.headers.get('Cookie'))
    const params = new URLSearchParams(await request.text())
    const actionId = params.get('actionId')

    if (actionId === actionIds.logout) {
      await signOutSession(session)

      return redirect('/', {
        headers: {'Set-Cookie': await rootStorage.commitSession(session)},
      })
    }
    if (actionId === actionIds.changeDetails) {
      const newFirstName = params.get('firstName')
      if (newFirstName && user.firstName !== newFirstName) {
        await updateUser(user.id, {firstName: newFirstName})
      }
    }

    return redirect('/me')
  })
}

const SHOW_QR_DURATION = 15_000

function YouScreen() {
  const data = useRouteData<LoaderData>()
  const user = useUser()
  const userInfo = useUserInfo()
  const requestInfo = useRequestInfo()
  const authorizeURL = getDiscordAuthorizeURL(requestInfo.origin)
  const [qrIsVisible, setQrIsVisible] = useState(false)

  useEffect(() => {
    if (!qrIsVisible) return

    const timeout = setTimeout(() => {
      setQrIsVisible(false)
    }, SHOW_QR_DURATION)

    return () => clearTimeout(timeout)
  }, [qrIsVisible, setQrIsVisible])

  return (
    <div>
      <div className="mb-64 mt-24 pt-6">
        <Grid>
          <div className="col-span-full mb-12 lg:mb-20">
            <div className="flex flex-col-reverse items-start justify-between lg:flex-row lg:items-center">
              <div>
                <H2 className="mb-2">Here’s your profile.</H2>
                <H2 variant="secondary" as="p">
                  Edit as you wish.
                </H2>
              </div>
              <Form action="/me" method="post">
                <input type="hidden" name="actionId" value={actionIds.logout} />
                <button
                  type="submit"
                  className="flex col-span-full items-center self-end mb-12 px-11 py-6 text-black dark:text-white border-2 border-gray-600 rounded-full space-x-4 lg:col-span-8 lg:col-start-3 lg:self-auto lg:mb-0"
                >
                  <LogoutIcon />
                  <H6 as="span">logout</H6>
                </button>
              </Form>
            </div>
          </div>

          <Form
            action="/me"
            method="post"
            className="col-span-full mb-24 lg:col-span-5 lg:mb-0"
          >
            <input
              type="hidden"
              name="actionId"
              value={actionIds.changeDetails}
            />
            <Label className="mb-4" htmlFor="firstName">
              First name
            </Label>

            <Input
              className="mb-8"
              name="firstName"
              id="firstName"
              autoComplete="firstName"
              defaultValue={user.firstName}
              required
            />

            <Label className="mb-4" htmlFor="email-address">
              Email address
            </Label>

            <Input
              name="email"
              id="email-address"
              autoComplete="email"
              required
              defaultValue={user.email}
              className="mb-8"
              readOnly
              disabled
            />

            <div className="flex flex-wrap items-baseline justify-between mb-4">
              <Label htmlFor="discord-id">Discord</Label>
              <p
                id="discord-message"
                className="dark:text-blueGray-500 text-gray-500 text-lg"
              >
                {user.discordId ? (
                  <a
                    className="text-black dark:text-white"
                    href={`https://discord.com/users/${user.discordId}`}
                  >
                    connected
                  </a>
                ) : (
                  <a
                    className="focus-ring text-black dark:text-white rounded-lg"
                    href={authorizeURL}
                  >
                    Connect to Discord
                  </a>
                )}
              </p>
            </div>

            <Input
              id="discord-id"
              name="discord"
              value={userInfo.discord?.username ?? user.discordId ?? ''}
              placeholder="n/a"
              className="mb-12 lg:mb-20"
              aria-describedby="discord-message"
              readOnly
              disabled
            />

            <Button type="submit">Save changes</Button>
          </Form>

          <div className="col-span-full lg:col-span-4 lg:col-start-8">
            <Label className="mb-4" htmlFor="chosen-team">
              Chosen team
            </Label>

            <input
              className="sr-only"
              type="radio"
              name="team"
              value={user.team}
              checked
              readOnly
            />

            <div className="relative col-span-full mb-3 bg-gray-100 dark:bg-gray-800 rounded-lg focus-within:outline-none ring-2 focus-within:ring-2 ring-team-current ring-offset-4 ring-offset-team-current ring-offset-team-current lg:col-span-4 lg:mb-0">
              <span className="absolute left-9 top-9 text-team-current">
                <CheckCircledIcon />
              </span>

              <div className="block pb-12 pt-20 px-12 text-center">
                <img
                  className="block mb-16"
                  src={TEAM_MAP[user.team].image()}
                  alt={TEAM_MAP[user.team].image.alt}
                />
                <H6 as="span">{TEAM_MAP[user.team].label}</H6>
              </div>
            </div>
          </div>
        </Grid>
      </div>

      <Grid>
        <div className="col-span-full mb-12 lg:col-span-5 lg:col-start-8 lg:mb-0">
          <H2 className="mb-2">Need to login somewhere else?</H2>
          <H2 variant="secondary" as="p">
            Scan this QR code on the other device.
          </H2>
        </div>

        <div className="relative col-span-full lg:col-span-5 lg:col-start-1 lg:row-start-1">
          <img
            src={data.qrLoginCode}
            alt="Login QR Code"
            className="w-full rounded-lg object-contain"
          />
          <button
            onClick={() => setQrIsVisible(true)}
            className={clsx(
              'focus-ring text-primary bg-secondary absolute inset-0 flex flex-col items-center justify-center w-full h-full text-lg font-medium rounded-lg transition duration-200',
              {
                'opacity-100': !qrIsVisible,
                'opacity-0': qrIsVisible,
              },
            )}
          >
            <EyeIcon size={36} />
            <span>click to reveal</span>
          </button>
        </div>
      </Grid>
    </div>
  )
}

export default YouScreen
