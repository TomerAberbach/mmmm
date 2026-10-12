import type { MailboxEmail } from '../mailbox.server.ts'

export const MailboxEmails = ({
  emails,
}: {
  emails: readonly MailboxEmail[]
}) => (
  <ul className='flex flex-col gap-3'>
    {emails.map(email => (
      <li key={email.id}>
        <details className='border-2 border-ink'>
          <summary className='cursor-pointer px-4 py-3'>
            <span className='font-semibold'>{email.subject}</span> to{` `}
            {email.to},{` `}
            {/* The server's time zone, which can differ from the browser's */}
            <time
              dateTime={email.sentAt.toISOString()}
              suppressHydrationWarning
            >
              {email.sentAt.toLocaleString(`en-US`, { timeZoneName: `short` })}
            </time>
          </summary>
          <div className='grid gap-4 border-t-2 border-ink p-4 lg:grid-cols-2'>
            {/* The sandbox stops the email's HTML from running scripts or
                reaching the app */}
            <iframe
              title={`${email.subject}, as HTML`}
              sandbox='allow-popups allow-popups-to-escape-sandbox'
              srcDoc={openLinksInNewTab(email.html)}
              className='h-96 w-full border border-muted bg-white'
            />
            <pre className='overflow-x-auto font-mono text-sm whitespace-pre-wrap'>
              {email.text}
            </pre>
          </div>
        </details>
      </li>
    ))}
  </ul>
)

// The app refuses to load inside a frame, so the email's links open in a new
// tab. The <base> goes inside <head>, because markup before the doctype
// switches to quirks mode
const openLinksInNewTab = (html: string): string =>
  html.replace(/<head\b[^>]*>/iu, match => `${match}<base target="_blank">`)
