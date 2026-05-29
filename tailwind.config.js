/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#fef2f2',
                    100: '#fee2e2',
                    200: '#fecaca',
                    300: '#fca5a5',
                    400: '#f87171',
                    500: '#E50914', // Brand Red
                    600: '#dc2626',
                    700: '#b91c1c',
                    800: '#991b1b',
                    900: '#7f1d1d',
                },
                dark: {
                    900: '#000000', // Deepest Black
                    800: '#0a0a0a', // Surface
                    700: '#121212', // Card Bg
                    600: '#1a1a1a',
                    500: '#2e2e2e',
                },
                glass: {
                    base: 'var(--glass-base)',
                    border: 'var(--glass-border)',
                    highlight: 'var(--glass-highlight)',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            backgroundImage: {
                'glass-gradient': 'linear-gradient(145deg, rgba(30, 30, 30, 0.6) 0%, rgba(10, 10, 10, 0.4) 100%)',
                'glass-shine': 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.05) 25%, transparent 30%)',
            }
        },
    },
    plugins: [],
};
