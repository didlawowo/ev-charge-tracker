import { h } from 'vue'

// Jeu d'icônes SVG minimal (trait 2px, grille 24) — remplace les emojis dont le
// rendu varie selon l'OS et qui ne suivent pas la couleur du texte.
const ICONS = {
  search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'm20 20-3.5-3.5' }]],
  x: [['path', { d: 'M18 6 6 18M6 6l12 12' }]],
  refresh: [['path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }], ['path', { d: 'M21 3v6h-6' }]],
  sliders: [
    ['path', { d: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12' }],
    ['circle', { cx: 16, cy: 6, r: 2 }],
    ['circle', { cx: 10, cy: 12, r: 2 }],
    ['circle', { cx: 18, cy: 18, r: 2 }]
  ],
  battery: [['rect', { x: 2, y: 7, width: 17, height: 10, rx: 2 }], ['path', { d: 'M22 11v2M6 10v4M10 10v4' }]],
  locate: [
    ['circle', { cx: 12, cy: 12, r: 3 }],
    ['circle', { cx: 12, cy: 12, r: 8 }],
    ['path', { d: 'M12 2v2M12 20v2M2 12h2M20 12h2' }]
  ],
  map: [['path', { d: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14' }]],
  list: [
    ['path', { d: 'M9 6h12M9 12h12M9 18h12' }],
    ['circle', { cx: 4, cy: 6, r: 1 }],
    ['circle', { cx: 4, cy: 12, r: 1 }],
    ['circle', { cx: 4, cy: 18, r: 1 }]
  ],
  navigation: [['path', { d: 'M3 11 22 2l-9 19-2-8-8-2z' }]],
  external: [['path', { d: 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }]],
  bolt: [['path', { d: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z' }]],
  chevronUp: [['path', { d: 'm6 15 6-6 6 6' }]],
  chevronDown: [['path', { d: 'm6 9 6 6 6-6' }]],
  snowflake: [['path', { d: 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7' }]],
  repeat: [['path', { d: 'm17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3' }]],
  offline: [['path', { d: 'M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.4M19 12.9a10 10 0 0 0-2.2-1.6M1.4 9a15 15 0 0 1 4.6-2.8M22.6 9a15 15 0 0 0-11.9-3.9M12 20h.01' }]],
  alert: [['path', { d: 'M12 3 2 21h20L12 3zM12 10v5M12 18v.01' }]],
  check: [['path', { d: 'm5 12 5 5 9-10' }]],
  route: [
    ['circle', { cx: 6, cy: 19, r: 2 }],
    ['circle', { cx: 18, cy: 5, r: 2 }],
    ['path', { d: 'M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16' }]
  ],
  clock: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
  pin: [['path', { d: 'M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z' }], ['circle', { cx: 12, cy: 10, r: 2.5 }]]
}

export default {
  name: 'AppIcon',
  props: {
    name: { type: String, required: true },
    size: { type: [Number, String], default: 20 }
  },
  setup(props) {
    return () => h(
      'svg',
      {
        class: 'app-icon',
        width: props.size,
        height: props.size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        focusable: 'false'
      },
      (ICONS[props.name] || []).map(([tag, attrs]) => h(tag, attrs))
    )
  }
}
