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
            {/* The browser's time zone can differ from the server's */}
            <time
              dateTime={email.sentAt.toISOString()}
              suppressHydrationWarning
            >
              {email.sentAt.toLocaleString(`en-US`)}
            </time>
          </summary>
          <div className='grid gap-4 border-t-2 border-ink p-4 lg:grid-cols-2'>
            {/* The sandbox stops the email's HTML from running scripts or
                reaching the app. Its links open in a new tab, since the app
                refuses to load inside a frame */}
            <iframe
              title={`${email.subject}, as HTML`}
              sandbox='allow-popups allow-popups-to-escape-sandbox'
              srcDoc={`<base target="_blank">${email.html}`}
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
