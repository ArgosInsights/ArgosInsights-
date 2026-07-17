# Argos Insights — Landing page

Landing de una sola página para Argos Insights, servicio de consultoría en datos financieros
para pymes proveedoras de grandes empresas.

Sitio 100% estático: HTML + Tailwind CSS (vía CDN) + JavaScript vanilla. Sin build step,
sin backend, sin base de datos.

## Estructura

```
argos-landing/
├── index.html   # todo el sitio (secciones separadas por comentarios <!-- N. NOMBRE -->)
└── README.md
```

Cada sección del `index.html` está delimitada con comentarios (`<!-- 1. HERO -->`,
`<!-- 2. EL PROBLEMA -->`, etc.) para poder editar el copy rápido sin tener que leer
todo el archivo.

## Placeholder pendiente antes de publicar

Solo queda un valor por reemplazar en `index.html`:

| Placeholder | Dónde aparece | Reemplazar por |
|---|---|---|
| `https://wa.me/56XXXXXXXXX` | Botón hero, nav, CTA final | Link real de WhatsApp de Argos Insights (`https://wa.me/56912345678`) |

El nombre (Argos Insights) y el correo (argosconsulta@gmail.com) ya están cargados en
título, nav, footer y CTA final.

La sección de testimonios está comentada al final (bloque `<!-- TESTIMONIOS (placeholder,
desactivado) -->`). Cuando tengas testimonios reales, descoméntala y reemplaza el
contenido de ejemplo.

## Correr en local

No requiere instalación. Basta con abrir el archivo directamente:

```bash
# opción 1: doble clic en index.html, o
open index.html        # macOS
start index.html        # Windows
```

Si prefieres un servidor local (recomendado para que las rutas y el scroll funcionen
igual que en producción):

```bash
npx serve .
# o
python3 -m http.server 8000
```

## Desplegar gratis

### Opción A: Vercel

1. Crea una cuenta en [vercel.com](https://vercel.com) (gratis).
2. Instala la CLI: `npm i -g vercel`
3. Desde esta carpeta: `vercel`
4. Sigue las instrucciones (proyecto sin framework / "Other"). Vercel detecta que es
   HTML estático y no requiere configuración adicional.
5. `vercel --prod` para publicar en producción.

También puedes arrastrar la carpeta directamente en [vercel.com/new](https://vercel.com/new)
sin usar la CLI.

### Opción B: Netlify

1. Crea una cuenta en [netlify.com](https://netlify.com) (gratis).
2. Arrastra la carpeta `argos-landing` a [app.netlify.com/drop](https://app.netlify.com/drop).
3. Netlify publica el sitio al instante con una URL `*.netlify.app`.
4. Opcional: conecta un dominio propio desde el panel del sitio ("Domain settings").

Ambas opciones son gratuitas para este uso (sitio estático, sin backend) y permiten
conectar un dominio propio después.
