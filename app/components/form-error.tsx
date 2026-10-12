import { Notice } from './notice.tsx'

// Goes below the submit button, so the fields above stay put when it appears
export const FormError = ({
  form,
}: {
  form: { errors?: string[]; errorId: string }
}) => {
  const [error] = form.errors ?? []
  return error ? (
    <Notice kind='alert' id={form.errorId}>
      {error}
    </Notice>
  ) : null
}
