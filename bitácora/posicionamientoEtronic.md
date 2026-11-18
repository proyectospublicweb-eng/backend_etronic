# Plan de Posicionamiento Web en Bing Webmaster Tools — `etronic.com.mx`

**Dominio objetivo único:** `https://etronic.com.mx/`  
**Objetivo:** Mantener **`https://etronic.com.mx/`** completamente optimizado, verificado e indexando correctamente mediante **Bing Webmaster Tools** e **IndexNow** (`$0`, cubriendo Bing, DuckDuckGo, Yahoo, Ecosia, Microsoft Copilot y ChatGPT Search).

---

## Fase 1 — Base Técnica en el Proyecto (`$0` · En Código)

- [x] **1.1 Configurar `robots.txt` público (`Frontend/public/robots.txt`)**
  - Permite indexación exclusiva de `/` para buscadores tradicionales e IA (`bingbot`, `DuckDuckBot`, `Applebot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`).
  - Excluye del índice `/planificador`, `/adminetronic`, `/login` y `/apietronic/`, enlazando `https://etronic.com.mx/sitemap.xml`.
- [x] **1.2 Configurar `sitemap.xml` (`Frontend/public/sitemap.xml`)**
  - Lista únicamente `https://etronic.com.mx/` (prioridad `1.0`) para concentrar toda la autoridad en el dominio principal.
- [x] **1.3 Generar clave IndexNow (`Frontend/public/8f3c9b2e4d1a7c605e82a914b7d3c6f0.txt`)**
  - Clave hexadecimal pública activa en producción para notificar actualizaciones al instante.
- [x] **1.4 Metadatos, JSON-LD, UTF-8 y Contenido HTML Inicial (`Frontend/index.html` y `Frontend/public/.htaccess`)**
  - Etiqueta `<link rel="canonical" href="https://etronic.com.mx/" />` y verificación `<meta name="msvalidate.01" content="5DBCEC29BEBF5D8A9654710D6A301AFE" />`.
  - Título, descripción, palabras clave y esquema **JSON-LD Schema.org** (`Organization` + `ProfessionalService` + catálogo de servicios).
  - Contenido semántico inicial completo dentro de `<div id="root">` (títulos `H1`/`H2` y servicios reales de ETRONIC visibles antes de ejecutar JS) + `AddDefaultCharset UTF-8` en `.htaccess` para que Bingbot lea contenido rico desde la primera petición HTTP.
- [ ] **1.5 Desplegar ajuste final UTF-8 + contenido HTML inicial en `etronic.com.mx`**
  - Confirmar `commit` + `push` de `Frontend` (los archivos previos `robots.txt`, `sitemap.xml`, llave IndexNow y `msvalidate.01` ya están en vivo `200 OK`).

---

## Fase 2 — Alta, Verificación y Seguimiento en Bing Webmaster Tools (`$0`)

- [x] **2.1 Verificación del dominio y envío de Sitemap en Bing Webmaster Tools** (`https://www.bing.com/webmasters`)
  - Dominio `https://etronic.com.mx` verificado el `2026-11-18` con `msvalidate.01`.
  - Mapa del sitio `https://etronic.com.mx/sitemap.xml` enviado sin errores.
  - Solicitud manual de indexación enviada para `https://etronic.com.mx/`.
- [x] **2.2 Notificación instantánea IndexNow**
  - Envío realizado el `2026-11-18` contra `https://api.indexnow.org/indexnow` con respuesta **`202 Accepted`**.
- [ ] **2.3 Validación final en Bing Webmaster Tools (tras el despliegue de 1.5 y 24–72 h)**
  - Confirmar en **Mapas del sitio** que `sitemap.xml` aparezca con estado **Correcto** y `1` URL descubierta (`https://etronic.com.mx/`).
  - En **Inspección de URL**, probar **`https://etronic.com.mx/`** (botón *Prueba URL activa*) y comprobar que reemplace la caché antigua (`19 May 2025`) y quede sin errores en el apartado **Índice**.
  - Revisar **Recommendations / Explorador de sitios** para confirmar 0 advertencias técnicas de SEO/GEO y validar búsqueda `site:etronic.com.mx` en Bing / DuckDuckGo / Yahoo.
