/** Returns whether the browser allowed copying */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    // Runs only in the browser, so Node's support doesn't apply
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
