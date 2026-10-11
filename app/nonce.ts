import { createContext } from 'react-router'

// The content security policy nonce of the current request
export const nonceContext = createContext<string>()
