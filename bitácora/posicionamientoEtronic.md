# Plan de Posicionamiento Web (Sin Google) — `etronic.com.mx`

**Dominio principal:** `https://etronic.com.mx/`  
**Página de conversión / embudo:** `https://etronic.com.mx/planificador`  
**Enfoque:** Posicionamiento rápido y tráfico B2B fuera de Google (Bing, DuckDuckGo, Yahoo, Apple Maps, buscadores de IA como ChatGPT/Copilot/Perplexity, WhatsApp, LinkedIn y Meta), priorizando acciones **100% gratuitas (`$0`)** antes de cualquier pauta opcional de pago.

---

## Fase 1 — Preparación Técnica en el Sitio (`$0` · En Código)

- [x] **1.1 Crear `robots.txt` público (`Frontend/public/robots.txt`)**
  - Permite indexación de `/` y `/planificador` para buscadores tradicionales e IA (`bingbot`, `DuckDuckBot`, `Applebot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`).
  - Bloquea rutas privadas (`/adminetronic`, `/login`, `/apietronic/`) y enlaza `https://etronic.com.mx/sitemap.xml`.
- [x] **1.2 Crear `sitemap.xml` (`Frontend/public/sitemap.xml`)**
  - Incluye `https://etronic.com.mx/` (prioridad `1.0`) y `https://etronic.com.mx/planificador` (prioridad `0.9`).
- [x] **1.3 Generar archivo de verificación IndexNow (`Frontend/public/8f3c9b2e4d1a7c605e82a914b7d3c6f0.txt`)**
  - Clave hexadecimal pública lista para indexación instantánea en Bing, DuckDuckGo, Yahoo y Ecosia tras desplegar `Frontend`.
- [x] **1.4 Metadatos SEO, Open Graph, Twitter Card y JSON-LD (`Frontend/index.html` y `PlannerPage.jsx`)**
  - Etiqueta `<link rel="canonical" href="https://etronic.com.mx/" />`.
  - Título y descripción actualizados incluyendo **Windows, Office 365, Contpaqi, Servidores Virtuales, IA a la medida y Planificador de Proyecto**.
  - Tarjetas enriquecidas **Open Graph (`og:*`)** y **Twitter (`twitter:card`)** usando `https://etronic.com.mx/images/hero-3d-tech.jpg` para vista previa visual en **WhatsApp, LinkedIn, Facebook y X**.
  - Datos estructurados **Schema.org (`@graph`: `Organization` + `ProfessionalService` + catálogo de 5 servicios)** para comprensión por motores alternativos e IA.
  - Título dinámico en `/planificador` (`"Planificador de Proyecto | ETRONIC"`).
- [x] **1.5 Subir cambios a GitHub y desplegar en producción (`etronic.com.mx`)**
  - Publicados commits (`Frontend`: `cd90fdb`, `Backend`: `24aa292`) y verificados en vivo (`200 OK` el `2026-11-18`):
    - `https://etronic.com.mx/robots.txt` (`200 OK`)
    - `https://etronic.com.mx/sitemap.xml` (`200 OK`)
    - `https://etronic.com.mx/8f3c9b2e4d1a7c605e82a914b7d3c6f0.txt` (`200 OK`)
    - `https://etronic.com.mx/planificador` (`200 OK`)

---

## Fase 2 — Buscadores Alternativos e Inteligencia Artificial (`$0` · Tras Desplegar)

- [ ] **2.1 Alta en Bing Webmaster Tools** (`https://www.bing.com/webmasters`) *(Cuenta creada; falta verificar tras desplegar `msvalidate.01`)*
  - Metaetiqueta de verificación agregada en `Frontend/index.html` (`<meta name="msvalidate.01" content="5DBCEC29BEBF5D8A9654710D6A301AFE" />`).
  - Siguiente: publicar cambios en producción (`commit` + `push`), pulsar **Comprobar** en Bing Webmaster Tools y enviar el mapa del sitio `https://etronic.com.mx/sitemap.xml`.
  - *Beneficio:* Indexa en **Bing, DuckDuckGo, Yahoo, Ecosia, Microsoft Copilot y ChatGPT Search**.
- [x] **2.2 Disparar notificación instantánea IndexNow (una vez en producción el `.txt`)**
  - Ejecutado el `2026-11-18` contra `https://api.indexnow.org/indexnow` con resultado **`202 Accepted`** para `https://etronic.com.mx/` y `https://etronic.com.mx/planificador`.
- [ ] **2.3 Alta en Bing Places for Business** (`https://www.bingplaces.com`) *(Requiere cuenta Microsoft del propietario)*
  - Registrar **ETRONIC**, teléfono/WhatsApp, horario, área de cobertura remota en México y enlace a `https://etronic.com.mx`.
- [ ] **2.4 Alta en Apple Business Connect** (`https://businessconnect.apple.com`) *(Requiere Apple ID del propietario)*
  - Registrar marca con Apple ID para aparecer en **Apple Maps, Siri y Spotlight**.

---

## Fase 3 — Tráfico Rápido en Redes, WhatsApp y Directorios B2B (`$0`)

- [ ] **3.1 Validar tarjeta enriquecida al compartir en WhatsApp, LinkedIn y Facebook**
  - Enviar `https://etronic.com.mx` en un chat privado de prueba en WhatsApp y validar en el **Meta Sharing Debugger** / **LinkedIn Post Inspector** que muestre imagen `hero-3d-tech.jpg` + descripción.
- [ ] **3.2 Crear / optimizar Página de Empresa en LinkedIn**
  - Configurar logotipo, descripción enfocada en **Soporte Contpaqi, Windows/Office 365, Servidores Cloud e IA** y botón principal apuntando a `https://etronic.com.mx/planificador`.
  - Publicar demostraciones visuales de las miniaturas estilo `monday.com` del Planificador y casos de IA.
- [ ] **3.3 Optimizar Facebook, Instagram y perfil de WhatsApp Business**
  - Colocar `https://etronic.com.mx` como sitio web principal y `https://etronic.com.mx/planificador` en mensajes de bienvenida/catálogo para captar leads automáticos hacia `/adminetronic`.
- [ ] **3.4 Alta en directorios B2B con enlaces entrantes gratuitos**
  - Registrar perfil gratuito en **SIEM** (México), **Clutch** (servicios TI/IA), **Sortlist** y **Sección Amarilla** web gratuita enlazando a `https://etronic.com.mx`.

---

## Fase 4 — Aceleradores Pagos (100% Opcionales)

- [ ] **4.1 Microsoft Advertising (Bing Ads)** *(Opcional · De pago)*
  - Campaña de búsqueda dirigida a usuarios Edge/Windows buscando *"soporte Contpaqi remoto"*, *"renta servidores virtuales"* o *"implementación IA empresas"*.
- [ ] **4.2 Meta Ads (Facebook / Instagram) hacia `/planificador`** *(Opcional · De pago)*
  - Campaña de clientes potenciales o tráfico directo hacia `https://etronic.com.mx/planificador`.
- [ ] **4.3 LinkedIn Ads / Cámaras Empresariales (CANACO / COPARMEX)** *(Opcional · De pago)*
  - Segmentación por puesto (*Contadores*, *Directores*, *Gerentes de TI*) o directorio oficial de socios.
