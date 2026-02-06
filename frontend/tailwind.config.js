/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Language colors
        'lang-js': '#f7df1e',
        'lang-ts': '#3178c6',
        'lang-python': '#3776ab',
        // Role colors
        'role-component': '#61dafb',
        'role-utility': '#10b981',
        'role-service': '#8b5cf6',
        'role-model': '#f59e0b',
        'role-config': '#6b7280',
        'role-test': '#ef4444',
      },fontFamily: {
        // Add the fonts you want to use
        poppins: ['Poppins', 'sans-serif'],
        quicksand: ['Quicksand', 'sans-serif'],
        comfortaa: ['Comfortaa', 'sans-serif'],
        nunito: ['Nunito', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
        // urbanist is good for features
        urbanist: ['Urbanist', 'sans-serif'],
        dmsans : ['DM Sans', 'sans-serif'],
        jakarta: ['Plus Jakarta Sans', 'sans-serif'],

        // =============================================
        // SANS-SERIF - GROTESQUE
        // =============================================
        'source-sans': ['Source Sans 3', 'sans-serif'],
        'barlow': ['Barlow', 'sans-serif'],
        'manrope': ['Manrope', 'sans-serif'],
        'sora': ['Sora', 'sans-serif'],

        // =============================================
        // SANS-SERIF - HUMANIST
        // =============================================
        'open-sans': ['Open Sans', 'sans-serif'],
        'lato': ['Lato', 'sans-serif'],
        'nunito-sans': ['Nunito Sans', 'sans-serif'],
        'cabin': ['Cabin', 'sans-serif'],
        'karla': ['Karla', 'sans-serif'],
        'rubik': ['Rubik', 'sans-serif'],
        'albert-sans': ['Albert Sans', 'sans-serif'],

        // =============================================
        // SANS-SERIF - TECHNICAL/INDUSTRIAL
        // =============================================
        oswald: ['Oswald', 'sans-serif'],
        'bebas': ['Bebas Neue', 'sans-serif'],
        'anton': ['Anton', 'sans-serif'],
        'teko': ['Teko', 'sans-serif'],
        'fjalla': ['Fjalla One', 'sans-serif'],
        'barlow-condensed': ['Barlow Condensed', 'sans-serif'],
        'saira': ['Saira', 'sans-serif'],
        'big-shoulders': ['Big Shoulders Display', 'sans-serif'],

        // =============================================
        // SERIF - CLASSICAL
        // =============================================
        'playfair': ['Playfair Display', 'serif'],
        'cormorant': ['Cormorant Garamond', 'serif'],
        'baskerville': ['Libre Baskerville', 'serif'],
        'eb-garamond': ['EB Garamond', 'serif'],
        'crimson': ['Crimson Pro', 'serif'],
        'spectral': ['Spectral', 'serif'],
        'noto-serif': ['Noto Serif', 'serif'],
        'source-serif': ['Source Serif 4', 'serif'],

        // =============================================
        // SERIF - MODERN/DISPLAY
        // =============================================
        'abril': ['Abril Fatface', 'serif'],
        'bodoni': ['Bodoni Moda', 'serif'],
        'yeseva': ['Yeseva One', 'serif'],
        'oranienbaum': ['Oranienbaum', 'serif'],
        'goudy': ['Sorts Mill Goudy', 'serif'],
        'dm-serif': ['DM Serif Display', 'serif'],
        'young-serif': ['Young Serif', 'serif'],
        'fraunces': ['Fraunces', 'serif'],

        // =============================================
        // SERIF - SLAB
        // =============================================
        'roboto-slab': ['Roboto Slab', 'serif'],
        'arvo': ['Arvo', 'serif'],
        'zilla': ['Zilla Slab', 'serif'],
        'bitter': ['Bitter', 'serif'],
        'crete': ['Crete Round', 'serif'],
        'slabo': ['Slabo 27px', 'serif'],

        // =============================================
        // DISPLAY - RETRO/VINTAGE
        // =============================================
        'pacifico': ['Pacifico', 'cursive'],
        'righteous': ['Righteous', 'sans-serif'],
        'bungee': ['Bungee', 'sans-serif'],
        'monoton': ['Monoton', 'sans-serif'],
        'lobster': ['Lobster', 'cursive'],
        permanentmarker: ['Permanent Marker', 'cursive'],
        titan: ['Titan One', 'sans-serif'],
        'bangers': ['Bangers', 'sans-serif'],
        'alfa-slab': ['Alfa Slab One', 'serif'],

        // =============================================
        // DISPLAY - ELEGANT/SCRIPT
        // =============================================
        'great-vibes': ['Great Vibes', 'cursive'],
        'dancing': ['Dancing Script', 'cursive'],
        'pinyon': ['Pinyon Script', 'cursive'],
        'alex-brush': ['Alex Brush', 'cursive'],
        tangerine: ['Tangerine', 'cursive'],
        'allura': ['Allura', 'cursive'],
        'sacramento': ['Sacramento', 'cursive'],

        // =============================================
        // DISPLAY - HANDWRITTEN/CASUAL
        // =============================================
        'caveat': ['Caveat', 'cursive'],
        'kalam': ['Kalam', 'cursive'],
        'patrick': ['Patrick Hand', 'cursive'],
        'shadows': ['Shadows Into Light', 'cursive'],
        'indie': ['Indie Flower', 'cursive'],
        'amatic': ['Amatic SC', 'cursive'],
        'architects': ['Architects Daughter', 'cursive'],
        'handlee': ['Handlee', 'cursive'],

        // =============================================
        // MONOSPACE
        // =============================================
        'fira-code': ['Fira Code', 'monospace'],
        'jetbrains': ['JetBrains Mono', 'monospace'],
        'source-code': ['Source Code Pro', 'monospace'],
        'ibm-plex': ['IBM Plex Mono', 'monospace'],
        'space-mono': ['Space Mono', 'monospace'],
        'inconsolata': ['Inconsolata', 'monospace'],
        'roboto-mono': ['Roboto Mono', 'monospace'],
        'ubuntu-mono': ['Ubuntu Mono', 'monospace'],
        'anonymous': ['Anonymous Pro', 'monospace'],
      },
    },
  },
  plugins: [],
}
