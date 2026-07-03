import { createTheme } from '@mantine/core'

// Central place to tweak the app's visual identity. All colors below mirror
// the palette the app already used before the Mantine migration (see the
// old :root variables that used to live in index.css) so the redesign reads
// as "same brand, new skin" rather than a different product.
export const theme = createTheme({
  primaryColor: 'brandCyan',
  primaryShade: { light: 5, dark: 5 },

  colors: {
    // Brand accent — matches the former --color-primary (#00d4ff)
    brandCyan: [
      '#e0fbff', '#b3f2ff', '#80e8ff', '#4ddeff', '#26d6ff',
      '#00d4ff', '#00b8e0', '#0098b8', '#007890', '#005468',
    ],
    // Secondary brand accent — matches the former --color-secondary (#7b2fd4)
    brandPurple: [
      '#f3e8ff', '#dfc3ff', '#c99bff', '#b271ff', '#9d4dff',
      '#7b2fd4', '#6a25b8', '#591e9c', '#481780', '#371164',
    ],
    // Dark surfaces — matches the former --bg-* / --border variables
    dark: [
      '#e8e8f0', '#c8c8d8', '#a0a0b8', '#7a839a', '#5c5c78',
      '#33334d', '#222238', '#16162a', '#10101c', '#080810',
    ],
  },

  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  headings: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontWeight: '800',
  },

  defaultRadius: 'md',
  radius: { xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '18px' },

  components: {
    Button:    { defaultProps: { radius: 'md' } },
    Card:      { defaultProps: { radius: 'lg', withBorder: true, padding: 'lg' } },
    Paper:     { defaultProps: { radius: 'lg', withBorder: true } },
    TextInput: { defaultProps: { radius: 'sm' } },
    PasswordInput: { defaultProps: { radius: 'sm' } },
    NumberInput:   { defaultProps: { radius: 'sm' } },
    Badge:     { defaultProps: { radius: 'sm' } },
  },
})
