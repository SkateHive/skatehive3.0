import { swiperStyles } from './swiperStyles';
import { extendTheme } from '@chakra-ui/react';
import { Montserrat, Poppins } from 'next/font/google';
import { COLORS } from './colors';

const montserrat = Montserrat({
    weight: ['400', '700'],
    subsets: ['latin'],
});

const poppins = Poppins({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin'],
});

const limeTheme = extendTheme({
    colors: {
        background: `linear-gradient(45deg, ${COLORS.LIME_GREEN}, ${COLORS.LIME_YELLOW_GREEN})`, // YGw-HUE to YGw-T1
        text: COLORS.BLACK, // BLACK
        primary: COLORS.PURPLE_800, // M-HUE (hot pink)
        secondary: COLORS.LIME_YELLOW_GREEN, // YG-HUE
        accent: COLORS.GREEN_700, // G-HUE
        muted: COLORS.GRAY_200, // GRAY 9
        border: COLORS.GRAY_500, // GRAY 5
        error: COLORS.RED_600, // R-HUE
        success: COLORS.GREEN_400, // YG-T1
        warning: COLORS.YELLOW_600, // O-HUE
    },
    fonts: {
        heading: montserrat.style.fontFamily + ', sans-serif',
        body: poppins.style.fontFamily + ', sans-serif',
        mono: '"Courier New", monospace',
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
        normal: 300,
        medium: 400,
        bold: 900,
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
        tb1: `1px solid linear-gradient(90deg, ${COLORS.YELLOW_400}, ${COLORS.YELLOW_300})`, // Y-HUE to Y-T1
        borderRadius: '8px',
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
        xs: '0 0 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        outline: `0 0 0 3px linear-gradient(90deg, ${COLORS.BLUE_700}, ${COLORS.BLUE_600})`, // B-HUE to B-T1
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        none: 'none',
        'dark-lg': 'rgba(0, 0, 0, 0.4) 0px 10px 15px -3px, rgba(0, 0, 0, 0.3) 0px 4px 6px -2px',
    },
    styles: {
        global: {
            ...swiperStyles, // Apply Swiper styles globally
        },
    },
    components: {
        Button: {
            baseStyle: {
                fontWeight: 'bold',
                textTransform: 'uppercase',
                borderRadius: 'base',
            },
            sizes: {
                sm: {
                    fontSize: 'sm',
                    px: 4,
                    py: 3,
                },
                md: {
                    fontSize: 'md',
                    px: 6,
                    py: 4,
                },
            },
            variants: {
                solid: {
                    bg: 'primary',
                    color: COLORS.GRAY_50, // WHITE 10 for contrast
                    _hover: {
                        bg: 'secondary',
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
            baseStyle: {
                field: {
                    borderColor: 'border',
                    _focus: {
                        borderColor: 'primary',
                        boxShadow: 'outline',
                    },
                },
            },
            sizes: {
                md: {
                    field: {
                        fontSize: 'md',
                        px: 4,
                        py: 2,
                    },
                },
            },
            variants: {
                outline: {
                    field: {
                        borderColor: 'border',
                        _hover: {
                            borderColor: 'primary',
                        },
                        _focus: {
                            borderColor: 'primary',
                            boxShadow: 'outline',
                        },
                    },
                },
                filled: {
                    field: {
                        bg: 'muted',
                        _hover: {
                            bg: 'muted',
                        },
                        _focus: {
                            bg: 'muted',
                            borderColor: 'primary',
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
    },
});

export default limeTheme; 