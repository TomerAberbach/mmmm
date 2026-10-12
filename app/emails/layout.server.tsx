import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components'
import type { ReactNode } from 'react'
import appCss from '../app.css?raw'
import { LETTER_COLORS } from '../components/letter-colors.tsx'
import { requireEnv } from '../env.server.ts'

const readAppColors = (): Record<string, string> =>
  Object.fromEntries(
    Array.from(
      appCss.matchAll(/--color-(?<name>[\w-]+):\s*(?<value>#[\da-f]+);/giu),
      ({ groups: { name = ``, value = `` } = {} }) => [name, value],
    ),
  )

// Email clients can't load the app's stylesheet, so the email theme reads the
// colors from its source. The email loads no web fonts, because loading them
// would send each reader's IP address to the font host. Each font stack names
// the app's font for readers who have it installed, then falls back
const EMAIL_THEME = {
  theme: {
    colors: readAppColors(),
    fontFamily: {
      sans: [
        `-apple-system`,
        `BlinkMacSystemFont`,
        `"Segoe UI"`,
        `Roboto`,
        `"Helvetica Neue"`,
        `Arial`,
        `sans-serif`,
      ],
      condensed: [
        `"Barlow Condensed"`,
        `"Arial Narrow"`,
        `Arial`,
        `sans-serif`,
      ],
      display: [`"Alfa Slab One"`, `Rockwell`, `Georgia`, `serif`],
    },
  },
}

export const EmailLayout = ({
  preview,
  heading,
  children,
}: {
  // The line inboxes show after the subject
  preview: string
  heading: string
  children: ReactNode
}) => {
  const supportEmail = requireEnv(`SUPPORT_EMAIL`)
  const { host } = new URL(requireEnv(`BETTER_AUTH_URL`))
  return (
    <Html lang='en'>
      <Tailwind config={EMAIL_THEME}>
        <Head />
        <Preview>{preview}</Preview>
        <Body className='m-0 bg-white font-sans text-ink'>
          <Container className='mx-auto max-w-xl px-8 pt-8 pb-6'>
            <Text className='m-0 font-display text-3xl leading-tight'>
              {LETTER_COLORS.slice(0, 4).map(colorClass => (
                <span key={colorClass} className={colorClass}>
                  M
                </span>
              ))}
            </Text>
            <Hr
              data-skip-in-text
              className='mt-4 mb-6 border-0 border-t-2 border-solid border-ink'
            />
            <Heading
              as='h1'
              className='m-0 mb-4 font-condensed text-3xl leading-tight font-extrabold uppercase'
            >
              {heading}
            </Heading>
            {children}
            <Hr className='mt-6 mb-4 border-0 border-t border-solid border-muted-light' />
            <Text className='m-0 text-xs leading-normal text-muted'>
              Sent by MMMM because this address was used at {host}. Questions?
              Email{` `}
              <Link
                href={`mailto:${supportEmail}`}
                className='text-accent-strong'
              >
                {supportEmail}
              </Link>
              .
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export const EmailParagraph = ({ children }: { children: ReactNode }) => (
  <Text className='m-0 mb-4 text-base leading-normal'>{children}</Text>
)

// The email's one action, as a button with a link to paste below it. The plain
// text shows the label with the link on the next line
export const EmailAction = ({
  href,
  children,
}: {
  href: string
  children: string
}) => (
  <>
    <Button
      data-action
      href={href}
      className='bg-accent-strong px-6 py-3 text-base font-bold text-white'
    >
      {children}
    </Button>
    <Section data-skip-in-text>
      <Text className='mt-5 mb-1 text-sm leading-normal text-muted'>
        Or paste this link into your browser:
      </Text>
      <Text className='m-0 mb-4 text-sm leading-normal break-all'>
        <Link href={href} className='text-accent-strong'>
          {href}
        </Link>
      </Text>
    </Section>
  </>
)
