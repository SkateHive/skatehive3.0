import { extendTheme } from '@chakra-ui/react';
import { COLORS } from './colors';

const gruvboxNoggTheme = extendTheme({
    config: {
        usesHeader: true,
        usesSidebar: false,
        initialColorMode: 'dark',
        useSystemColorMode: false,
    },
    semanticTokens: {
        colors: {
            _colorScheme: { _light: 'orange', _dark: 'orange' },
            _colorMode: 'dark',
        },
    },
    initialColorMode: 'dark',
    useSystemColorMode: false,
    colors: {
        background: COLORS.GRUVBOX_DARK_BG, // Authentic dark gruvbox background
        text: COLORS.GRUVBOX_DARK_FG, // Warm cream text
        primary: COLORS.GRUVBOX_ORANGE_BRIGHT, // Bright orange for primary actions
        secondary: COLORS.GRUVBOX_GRAY, // Neutral gray for secondary elements
        accent: COLORS.GRUVBOX_ORANGE, // Orange for accents - keeping orange theme
        muted: COLORS.GRUVBOX_DARK_BG_SOFT, // Slightly lighter background for muted elements
        border: COLORS.GRUVBOX_GRAY_DARK, // Darker gray for borders
        error: COLORS.GRUVBOX_RED_BRIGHT, // Bright red for errors
        success: COLORS.GRUVBOX_GREEN_BRIGHT, // Bright green for success
        warning: COLORS.GRUVBOX_YELLOW, // Yellow for warnings
    },
    fonts: {
        heading: 'var(--font-fira-mono), "Fira Code", "Consolas", monospace',
        body: 'var(--font-fira-mono), "Fira Code", "Source Code Pro", monospace',
        mono: 'var(--font-fira-mono), "Fira Code", "JetBrains Mono", monospace',
    },
    fontSizes: {
        xs: '12px',
        sm: '14px',
        md: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '30px',
        '4xl': '36px',
        '5xl': '48px',
        '6xl': '64px',
    },
    fontWeights: {
        normal: 400,
        medium: 500,
        bold: 700,
    },
    lineHeights: {
        normal: 'normal',
        none: 1,
        shorter: 1.25,
        short: 1.375,
        base: 1.5,
        tall: 1.625,
        taller: '2',
    },
    borders: {
        tb1: `1px solid ${COLORS.GRUVBOX_GRAY_DARK}`,
        tb2: `2px solid ${COLORS.GRUVBOX_ORANGE}`,
        borderRadius: '6px', // Slightly rounded for warmth
    },
    radii: {
        none: '0',
        sm: '2px',
        base: '6px',
        md: '8px',
        lg: '12px',
        full: '9999px',
    },
    space: {
        px: '1px',
        0: '0',
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        32: '8rem',
        40: '10rem',
        48: '12rem',
        56: '14rem',
        64: '16rem',
    },
    sizes: {
        max: 'max-content',
        min: 'min-content',
        full: '100%',
        '3xs': '14rem',
        '2xs': '16rem',
        xs: '20rem',
        sm: '24rem',
        md: '28rem',
        lg: '32rem',
        xl: '36rem',
        '2xl': '42rem',
        '3xl': '48rem',
        '4xl': '56rem',
        '5xl': '64rem',
        '6xl': '72rem',
        '7xl': '80rem',
        container: {
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
        },
    },
    shadows: {
        xs: `0 0 2px 0 rgba(254, 128, 25, 0.3)`, // Orange glow
        sm: `0 1px 2px 0 rgba(254, 128, 25, 0.4)`,
        base: `0 1px 3px 0 rgba(254, 128, 25, 0.4), 0 1px 2px 0 rgba(254, 128, 25, 0.2)`,
        md: `0 4px 6px -1px rgba(254, 128, 25, 0.4), 0 2px 4px -1px rgba(254, 128, 25, 0.2)`,
        lg: `0 10px 15px -3px rgba(254, 128, 25, 0.4), 0 4px 6px -2px rgba(254, 128, 25, 0.2)`,
        xl: `0 20px 25px -5px rgba(254, 128, 25, 0.4), 0 10px 10px -5px rgba(254, 128, 25, 0.2)`,
        '2xl': `0 25px 50px -12px rgba(254, 128, 25, 0.6)`,
        outline: `0 0 0 3px rgba(254, 128, 25, 0.5)`, // Orange focus outline
        inner: `inset 0 2px 4px 0 rgba(0, 0, 0, 0.6)`,
        none: 'none',
        'dark-lg': `rgba(254, 128, 25, 0.4) 0px 10px 15px -3px, rgba(254, 128, 25, 0.2) 0px 4px 6px -2px`,
    },
    components: {
        Button: {
            baseStyle: {
                fontWeight: 'medium',
                borderRadius: 'base',
                _focus: {
                    boxShadow: 'outline',
                },
            },
            sizes: {
                sm: {
                    fontSize: 'sm',
                    px: 4,
                    py: 2,
                },
                md: {
                    fontSize: 'md',
                    px: 6,
                    py: 3,
                },
            },
            variants: {
                solid: {
                    bg: 'primary',
                    color: 'background',
                    _hover: {
                        bg: 'accent',
                        transform: 'translateY(-1px)',
                    },
                    _active: {
                        transform: 'translateY(0px)',
                    },
                },
                outline: {
                    borderColor: 'primary',
                    color: 'primary',
                    _hover: {
                        bg: 'muted',
                        borderColor: 'accent',
                    },
                },
                ghost: {
                    color: 'primary',
                    _hover: {
                        bg: 'muted',
                        color: 'accent',
                    },
                },
            },
        },
        Input: {
            baseStyle: {
                field: {
                    borderColor: 'border',
                    bg: 'muted',
                    color: 'text',
                    _focus: {
                        borderColor: 'primary',
                        boxShadow: 'outline',
                    },
                    _hover: {
                        borderColor: COLORS.GRUVBOX_GRAY,
                    },
                },
            },
            sizes: {
                md: {
                    field: {
                        fontSize: 'md',
                        px: 4,
                        py: 3,
                    },
                },
            },
            variants: {
                outline: {
                    field: {
                        borderColor: 'border',
                        _hover: {
                            borderColor: COLORS.GRUVBOX_GRAY,
                        },
                        _focus: {
                            borderColor: 'primary',
                            boxShadow: 'outline',
                        },
                    },
                },
                filled: {
                    field: {
                        bg: COLORS.GRUVBOX_DARK_BG_HARD,
                        _hover: {
                            bg: COLORS.GRUVBOX_DARK_BG_SOFT,
                        },
                        _focus: {
                            bg: COLORS.GRUVBOX_DARK_BG_SOFT,
                            borderColor: 'primary',
                            boxShadow: 'outline',
                        },
                    },
                },
            },
        },
        Text: {
            baseStyle: {
                color: 'text',
            },
        },
        Card: {
            baseStyle: {
                bg: 'muted',
                borderColor: 'border',
                boxShadow: 'base',
            },
        },
        Link: {
            baseStyle: {
                color: 'primary',
                _hover: {
                    color: 'accent',
                    textDecoration: 'underline',
                },
            },
        },
    },
});

export default gruvboxNoggTheme;