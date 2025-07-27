import { extendTheme } from '@chakra-ui/react';

const whiteBlackTheme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  semanticTokens: {
    colors: {
      _colorScheme: { _light: 'gray', _dark: 'gray' },
      _colorMode: 'light',
    },
  },
  colors: {
    background: '#FFFFFF',       // Pure white background
    text: '#000000',             // Pure black text
    primary: '#000000',          // Black for primary elements
    'primary-alpha': '#00000080', // Semi-transparent black
    secondary: '#808080',        // Medium gray for secondary elements
    accent: '#404040',          // Dark gray for highlights
    muted: '#F5F5F5',           // Very light gray for muted backgrounds
    border: '#000000',          // Black borders
    error: '#000000',           // Black for errors (monochrome)
    success: '#000000',         // Black for success
    warning: '#404040',         // Dark gray for warnings
  },
  fonts: {
    heading: '"Helvetica Neue", Arial, sans-serif',
    body: '"Helvetica Neue", Arial, sans-serif',
    mono: '"Courier New", monospace',
  },
  fontSizes: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '18px',
    '3xl': '18px',
    '4xl': '18px',
    '5xl': '18px',
    '6xl': '18px',
    },
  fontWeights: {
    normal: 400,
    medium: 500,
    bold: 700,
  },
  lineHeights: {
    base: 1.6,
    short: 1.4,
    tall: 1.8,
  },
  borders: {
    tb1: '1px solid #000000',
    tb2: '2px solid #000000',
    borderRadius: '4px',
  },
  shadows: {
    xs: '0 0 2px 0 rgba(0, 0, 0, 0.2)',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.2), 0 1px 2px 0 rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
    outline: '0 0 0 2px rgba(0, 0, 0, 0.5)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)',
    none: 'none',
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'bold',
        borderRadius: 'md',
        border: '1px solid',
      },
      variants: {
        solid: {
          bg: 'black',
          color: 'white',
          borderColor: 'black',
          _hover: {
            bg: 'gray.800',
            color: 'white',
          },
          _active: {
            bg: 'gray.700',
          },
        },
        outline: {
          bg: 'transparent',
          color: 'black',
          borderColor: 'black',
          _hover: {
            bg: 'black',
            color: 'white',
          },
          _active: {
            bg: 'gray.800',
            color: 'white',
          },
        },
        ghost: {
          bg: 'transparent',
          color: 'black',
          borderColor: 'transparent',
          _hover: {
            bg: 'muted',
          },
          _active: {
            bg: 'gray.200',
          },
        },
      },
    },
    Input: {
      variants: {
        outline: {
          field: {
            borderColor: 'black',
            color: 'black',
            bg: 'transparent',
            _hover: { 
              borderColor: 'gray.600',
            },
            _focus: {
              borderColor: 'black',
              boxShadow: 'outline',
            },
            _placeholder: {
              color: 'gray.500',
            },
          },
        },
      },
    },
    Textarea: {
      variants: {
        outline: {
          borderColor: 'black',
          color: 'black',
          bg: 'transparent',
          _hover: { 
            borderColor: 'gray.600',
          },
          _focus: {
            borderColor: 'black',
            boxShadow: 'outline',
          },
          _placeholder: {
            color: 'gray.500',
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
    Heading: {
      baseStyle: {
        color: 'black',
        fontWeight: 'bold',
      },
    },
    Link: {
      baseStyle: {
        color: 'black',
        textDecoration: 'underline',
        _hover: {
          color: 'gray.600',
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'muted',
          border: '1px solid',
          borderColor: 'black',
          color: 'black',
        },
      },
    },
    Modal: {
      baseStyle: {
        dialog: {
          bg: 'background',
          border: '1px solid',
          borderColor: 'black',
        },
        header: {
          color: 'black',
          borderBottom: '1px solid',
          borderColor: 'black',
        },
        body: {
          color: 'black',
        },
        footer: {
          borderTop: '1px solid',
          borderColor: 'black',
        },
      },
    },
    Drawer: {
      baseStyle: {
        dialog: {
          bg: 'background',
          border: '1px solid',
          borderColor: 'black',
        },
        header: {
          color: 'black',
          borderBottom: '1px solid',
          borderColor: 'black',
        },
        body: {
          color: 'black',
        },
        footer: {
          borderTop: '1px solid',
          borderColor: 'black',
        },
      },
    },
    Menu: {
      baseStyle: {
        list: {
          bg: 'background',
          border: '1px solid',
          borderColor: 'black',
        },
        item: {
          color: 'black',
          _hover: {
            bg: 'muted',
          },
          _focus: {
            bg: 'muted',
          },
        },
      },
    },
    Alert: {
      variants: {
        solid: {
          container: {
            bg: 'black',
            color: 'white',
          },
        },
        outline: {
          container: {
            bg: 'transparent',
            borderColor: 'black',
            color: 'black',
          },
        },
      },
    },
    Badge: {
      baseStyle: {
        color: 'white',
        bg: 'black',
        border: '1px solid',
        borderColor: 'black',
      },
    },
    Tag: {
      baseStyle: {
        container: {
          bg: 'black',
          color: 'white',
          border: '1px solid',
          borderColor: 'black',
        },
      },
    },
    Divider: {
      baseStyle: {
        borderColor: 'black',
      },
    },
  },
});

export default whiteBlackTheme;
