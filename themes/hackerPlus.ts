import { extendTheme } from '@chakra-ui/react';

const hackerPlusTheme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  semanticTokens: {
    colors: {
      _colorScheme: { _light: 'lime', _dark: 'lime' },
      _colorMode: 'dark',
    },
  },
  colors: {
    background: '#121212',
    text: '#A8FF60',
    primary: '#a7ff00',
    'primary-alpha': '#a7ff00',
    secondary: '#FFBD4A',
    accent: 'rgba(255, 242, 2, 1)',
    muted: '#202020',
    border: '#A8FF60',
    error: '#FF5C57',
    success: '#5EFF7E',
    warning: '#FFBD4A',
    panel: '#1A1A1A',
    panelHover: '#252525',
    inputBg: '#0D0D0D',
    inputBorder: '#333333',
    inputText: '#E0E0E0',
    inputPlaceholder: '#666666',
    dim: '#888888',
    subtle: 'rgba(255,255,255,0.06)',
  },
  fonts: {
    heading: '"Fira Code", monospace',
    body: '"Fira Code", monospace',
    mono: '"Fira Code", monospace',
  },
  fontSizes: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '18px',
    '2xl': '18px',
    '3xl': '18px',
    '4xl': '18px',
    '5xl': '18px',
    '6xl': '18px',
  },
  fontWeights: {
    normal: 400,
    medium: 600,
    bold: 700,
  },
  lineHeights: {
    base: 1.6,
    short: 1.4,
    tall: 1.75,
  },
  borders: {
    tb1: '1px solid #A8FF60',
    tb2: '2px solid #FFD700',
    borderRadius: '0px',
  },
  shadows: {
    xs: '0 0 2px 0 rgba(168, 255, 96, 0.3)',
    sm: '0 1px 2px 0 rgba(168, 255, 96, 0.3)',
    base: '0 1px 3px 0 rgba(168, 255, 96, 0.3), 0 1px 2px 0 rgba(168, 255, 96, 0.2)',
    md: '0 4px 6px -1px rgba(168, 255, 96, 0.3), 0 2px 4px -1px rgba(168, 255, 96, 0.2)',
    outline: '0 0 0 2px rgba(168, 255, 96, 0.6)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.6)',
    none: 'none',
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'bold',
        textTransform: 'uppercase',
        borderRadius: 'none',
      },
      variants: {
        solid: {
          bg: 'primary',
          color: 'background',
          _hover: {
            bg: 'accent',
            color: 'background',
          },
        },
        outline: {
          borderColor: 'primary',
          color: 'primary',
          _hover: {
            bg: 'muted',
          },
        },
        ghost: {
          color: 'primary',
          _hover: {
            bg: 'muted',
          },
        },
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            borderColor: 'border',
            _hover: { borderColor: 'primary' },
            _focus: {
              borderColor: 'primary',
              boxShadow: 'outline',
            },
            bg: 'muted',
            color: 'text',
          },
        },
      },
    },
    Text: {
      baseStyle: {
        color: 'text',
        fontSize: 'md',
        lineHeight: 'base',
      },
    },
  },
});

export default hackerPlusTheme;
