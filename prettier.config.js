import tomer from '@tomer/prettier-config'

export default {
  ...tomer,
  // Lets the Tailwind plugin sort the theme's own classes
  tailwindStylesheet: `./app/app.css`,
}
