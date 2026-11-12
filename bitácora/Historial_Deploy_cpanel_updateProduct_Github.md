# Manual e Historial Técnico de Referencia: Despliegue en cPanel + Actualización Automática desde GitHub (CI/CD)

**Proyecto base de referencia:** `ETRONIC` (`https://etronic.com.mx/`)  
**Fecha de consolidación:** 2026-11-12  
**Stack cubierto:** Frontend (`React 19` + `Vite` / `Vite+` + `Tailwind CSS`) + Backend (`Node.js ESM` + `Express` + `JWT HttpOnly`) + Base de Datos (`PostgreSQL` en cPanel) + Servidor compartido **cPanel multi-dominio** (`Phusion Passenger` + `LiteSpeed/Apache`) + **GitHub Actions CI/CD vía HTTPS Puerto 443**.

> **Propósito de este documento:** Servir como guía maestra paso a paso y memoria técnica reutilizable para futuros proyectos, reuniendo todos los ajustes de código, configuraciones de servidor, comandos, plantillas y soluciones a bloqueos reales de cPanel/WAF/Firewall para lograr un despliegue limpio y automatizado desde el primer intento.

---

## Índice

1. [Arquitectura de Aislamiento en cPanel Multi-Dominio](#1-arquitectura-de-aislamiento-en-cpanel-multi-dominio)
2. [Preparación Obligatoria del Código antes de Subir a Producción](#2-preparación-obligatoria-del-código-antes-de-subir-a-producción)
3. [Configuración de Git Multi-Cuenta y Repositorios en GitHub](#3-configuración-de-git-multi-cuenta-y-repositorios-en-github)
4. [Despliegue Inicial Paso a Paso en cPanel](#4-despliegue-inicial-paso-a-paso-en-cpanel)
5. [Actualización Automática CI/CD (GitHub Actions → HTTPS Puerto 443)](#5-actualización-automática-cicd-github-actions--https-puerto-443)
6. [Catálogo de Incidentes Reales Encontrados y Cómo Evitarlos](#6-catálogo-de-incidentes-reales-encontrados-y-cómo-evitarlos)
7. [Checklist Exprés en 10 Pasos para Futuros Proyectos](#7-checklist-exprés-en-10-pasos-para-futuros-proyectos)

---

## 1. Arquitectura de Aislamiento en cPanel Multi-Dominio

Cuando una misma cuenta de cPanel (ej. `/home/<cuenta>/`) aloja varios dominios en producción con sus propios Frontends y Backends en Node.js, la separación total se garantiza respetando esta estructura:

```text
/home/<cuenta>/
├── public_html/ (o carpeta raíz propia del dominio en cPanel → Domains)
│   └── <tudominio.com>/              <-- Document Root EXCLUSIVO del Frontend (dist/)
│       ├── index.html
│       ├── assets/
│       ├── .htaccess                 <-- Reglas SPA + bloque Passenger (NO sobrescribir en deploys)
│       └── deploy-hook.php           <-- Receptor seguro HTTPS 443 para CI/CD de este proyecto
│
├── backend_<proyecto>/               <-- Fuera de public_html (código privado Node.js)
│   ├── loader.cjs                    <-- Puente CommonJS obligatorio para Passenger + ESM
│   ├── index.js
│   ├── package.json
│   ├── .env                          <-- Variables secretas en servidor (NUNCA en Git ni en CI/CD)
│   ├── src/
│   └── tmp/
│       └── restart.txt               <-- Tocar este archivo reinicia Node en caliente sin SSH
│
└── nodevenv/
    └── backend_<proyecto>/           <-- Entorno virtual aislado creado por cPanel por cada app Node
```

- **Base de datos aislada:** `<cuenta>_<proyecto>` en PostgreSQL con su propio usuario asignado.
- **URL del Backend en el mismo dominio:** Montada en subruta exclusiva (ej. `https://etronic.com.mx/apietronic`). Al compartir dominio con el Frontend, **las cookies `JWT HttpOnly` viajan como *first-party*** sin bloqueos de Safari/Chrome ni problemas de CORS entre dominios distintos.

---

## 2. Preparación Obligatoria del Código antes de Subir a Producción

### 2.1 Saneamiento de Credenciales y `.gitignore`
Antes de inicializar Git o hacer el primer commit:
1. Verificar que **ningún archivo** (`.js`, `.mjs`, `.sql`, `.env.example`, `.md`) contenga contraseñas reales en código, valores por defecto (`process.env.ADMIN_PASSWORD || "..."`) ni **comentarios SQL** con la contraseña en texto plano.
2. Confirmar que `Backend/.gitignore` ignore `.env`, `.env.*` (excepto `!.env.example`), `node_modules/` y carpetas locales de datos (`data/`).
3. Confirmar que `Frontend/.gitignore` ignore `node_modules/`, `dist/` y `.env*` (excepto `!.env.example`).

---

### 2.2 Puente `Backend/loader.cjs` para Phusion Passenger (Node ESM)
En cPanel (*Setup Node.js App*), Phusion Passenger carga el archivo de entrada usando `require()` (CommonJS). Si el Backend usa `"type": "module"` en `package.json` y `top-level await` en `index.js`, Passenger falla con `ERR_REQUIRE_ASYNC_MODULE` si apunta directo a `index.js`.

Además, Passenger no siempre inicia con `process.cwd()` en la carpeta del Backend, por lo que `import "dotenv/config"` puede no encontrar el `.env`. La solución definitiva es crear **`Backend/loader.cjs`**:

```js
// Backend/loader.cjs
const path = require("node:path");
const dotenv = require("dotenv");

// Carga explícita del .env ubicado junto a loader.cjs sin depender de process.cwd()
dotenv.config({ path: path.join(__dirname, ".env") });

import("./index.js").catch((error) => {
  console.error("Error crítico al iniciar Backend en cPanel:", error);
  process.exit(1);
});
```

---

### 2.3 Blindaje de Conexión PostgreSQL en `Backend/src/db.js`
En servidores cPanel con Node.js 20/22/24 se presentan **3 detalles críticos** con PostgreSQL local:
1. **IPv6 `::1` vs IPv4 `127.0.0.1`:** Node 20+ resuelve `localhost` primero a `::1`, provocando el error `code 28000: no pg_hba.conf entry for host "::1"`. Siempre se debe convertir `localhost` / `::1` a **`127.0.0.1`**.
2. **Espacios accidentales en variables de cPanel:** Al pegar `DB_USER` o `DB_NAME` en la interfaz web de cPanel puede colarse un espacio inicial (`" usuario_db"`), rompiendo la autenticación en `pg_hba.conf`. Siempre aplicar **`.trim()`**.
3. **SSL desactivado en conexión interna:** PostgreSQL dentro del mismo servidor cPanel (`127.0.0.1`) no utiliza SSL (`SSL off`).

Plantilla probada para **`Backend/src/db.js`**:

```js
import pg from "pg";

const { Pool } = pg;
const isProduction = process.env.NODE_ENV === "production";

function normalizeHost(rawHost) {
  const cleaned = String(rawHost || "127.0.0.1").trim();
  if (/^(localhost|::1)$/i.test(cleaned)) {
    return "127.0.0.1";
  }
  return cleaned;
}

function resolveSslConfig(hostOrUrl) {
  if (typeof process.env.DB_SSL === "string" && process.env.DB_SSL.trim() !== "") {
    return process.env.DB_SSL.trim().toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : false;
  }
  const target = String(hostOrUrl || "127.0.0.1").trim();
  if (/(^localhost$|^127\.0\.0\.1$|^::1$|@localhost[:/]|@127\.0\.0\.1[:/])/i.test(target)) {
    return false;
  }
  return isProduction || Boolean(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false;
}

const rawDbUrl = (process.env.DATABASE_URL || "").trim();
const dbHost = normalizeHost(process.env.DB_HOST);
const dbPort = Number(String(process.env.DB_PORT || "5432").trim()) || 5432;
const dbUser = (process.env.DB_USER || "").trim();
const dbPassword = (process.env.DB_PASSWORD || "").trim();
const dbName = (process.env.DB_NAME || "").trim();

export const pool = rawDbUrl
  ? new Pool({ connectionString: rawDbUrl, ssl: resolveSslConfig(rawDbUrl) })
  : new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      ssl: resolveSslConfig(dbHost),
    });
```

---

### 2.4 Doble Montaje de Rutas y `/health` en `Backend/src/app.js`
Según la versión de CloudLinux/LiteSpeed, Passenger al montar `/apietronic` puede entregar `req.url` con el prefijo (`/apietronic/login`) o recortado (`/login`). Montar ambos arregla cualquier variante:

```js
app.set("trust proxy", 1); // Obligatorio detrás del proxy HTTPS de cPanel para cookies secure

app.get(["/health", "/apietronic/health"], async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "backend_etronic", dbConnected: true });
  } catch (err) {
    res.status(500).json({
      ok: false,
      service: "backend_etronic",
      dbConnected: false,
      code: err.code || "DB_ERROR",
    });
  }
});

app.use(["/apietronic", "/"], authRoutes);
app.use(["/apietronic/chat", "/chat"], chatRoutes);
app.use(["/apietronic/admin", "/admin"], adminRoutes);
```

---

### 2.5 Configuración de `axios.js` y `.htaccess` en `Frontend/`

1. **`Frontend/src/api/axios.js`:** Usar ruta relativa en producción para que funcione tanto con `https://tudominio.com` como con `https://www.tudominio.com`:
   ```js
   import axios from "axios";

   const defaultApiUrl = import.meta.env.PROD
     ? "/apietronic"
     : "http://localhost:3000/apietronic";

   const instance = axios.create({
     baseURL: import.meta.env.VITE_API_URL || defaultApiUrl,
     withCredentials: true,
   });

   export default instance;
   ```

2. **`Frontend/public/.htaccess`:** Permite que Apache/LiteSpeed sirva archivos físicos reales (incluyendo `assets/*` y `deploy-hook.php`), respete `/apietronic` y envíe las rutas de React Router (`/admin...`, `/login`) a `index.html`:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /

     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_URI} !^/apietronic [NC]

     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d

     RewriteRule . /index.html [L]
   </IfModule>
   ```

---

## 3. Configuración de Git Multi-Cuenta y Repositorios en GitHub

Si en el equipo de desarrollo ya existen credenciales guardadas de otra cuenta de GitHub en el Administrador de Credenciales de Windows (GCM), ejecutar una vez:

```powershell
git config --global credential.https://github.com.useHttpPath true
```

Esto hace que Windows guarde la credencial **por repositorio completo** (`github.com/<organizacion>/<repo>`) en lugar de una sola cuenta global para todo `github.com`, evitando errores `403 Permission denied`. El primer `git push -u origin main` se ejecuta en una terminal interactiva para iniciar sesión en la ventana de GitHub; a partir de ahí los siguientes `push` son automáticos.

---

## 4. Despliegue Inicial Paso a Paso en cPanel

### Paso 1: Crear Base de Datos PostgreSQL, Usuario y Permisos
1. En **cPanel → Databases → PostgreSQL Databases**:
   - Crear la base de datos (ej. `<cuenta>_etronic`).
   - Crear el usuario (o elegir uno dedicado) con contraseña robusta.
   - **Paso indispensable:** En **Add User to Database**, seleccionar el usuario y la base de datos y pulsar **Submit** (en PostgreSQL de cPanel esto otorga los privilegios base).
2. **Crear tablas e inyectar el usuario administrador inicial:**
   - Para generar el hash `bcrypt` de la contraseña inicial en local, usar un archivo `.mjs` temporal (no `node -e "..."` en línea dentro de PowerShell si la contraseña contiene `#` o `$`, porque PowerShell recorta comillas internas):
     ```js
     // gen_hash.mjs (temporal, borrar después de usar)
     import bcrypt from "bcryptjs";
     console.log(await bcrypt.hash("TuPasswordSeguro#", 10));
     ```
   - En **cPanel → phpPgAdmin**, seleccionar la base de datos y ejecutar el script SQL de creación de tablas + `INSERT INTO public.usuarios ... ON CONFLICT (correoregistro) DO UPDATE` + permisos explícitos si se requieren:
     ```sql
     GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC;
     GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;
     ```
   - **Nota sobre ModSecurity en phpPgAdmin:** Si al pulsar *Ejecutar* aparece `HTTP error 401 / Requested page: 403.shtml`, es el firewall ModSecurity bloqueando palabras SQL (`CREATE TABLE` / `INSERT`) en el formulario web. Para evitarlo: subir el archivo `.sql` desde el botón de carga de script o desactivar **ModSecurity** temporalmente 1 minuto en *cPanel → Security → ModSecurity*, correr el script y volver a activarlo de inmediato.

---

### Paso 2: Crear y Arrancar el Backend en *Setup Node.js App*
1. En **cPanel → Software → Setup Node.js App → Create Application**:
   - **Node.js version:** `20.x` / `22.x` / `24.x` (la más reciente LTS disponible en el servidor).
   - **Application mode:** `Production`
   - **Application root:** `backend_<proyecto>` (ej. `backend_etronic`)
   - **Application URL:** `<tudominio.com>` → `/api<proyecto>` (ej. `apietronic`)
   - **Application startup file:** `loader.cjs`
2. En **File Manager**, subir el código del Backend dentro de `/home/<cuenta>/backend_<proyecto>/` (sin `node_modules`).
3. Volver a **Setup Node.js App**, entrar a la aplicación y hacer clic en **Run NPM Install**.
4. Configurar las variables de entorno (en `.env` dentro de `backend_<proyecto>/` y/o en *Environment variables*, cuidando **no dejar espacios al inicio o al final**):
   - `NODE_ENV=production`
   - `DB_HOST=127.0.0.1`
   - `DB_PORT=5432`
   - `DB_USER=<cuenta>_<usuario>`
   - `DB_PASSWORD=<password_bd>`
   - `DB_NAME=<cuenta>_<bd>`
   - `TOKEN_SECRET=<cadena_aleatoria_larga_64_chars>`
   - `FRONTEND_URL=https://<tudominio.com>,https://www.<tudominio.com>`
5. Hacer clic en **Restart** y verificar `https://<tudominio.com>/api<proyecto>/health` → debe responder `{"ok":true,"dbConnected":true}`.

---

### Paso 3: Subir el Frontend Inicial y Respetar `.htaccess` de Passenger
1. Al crear la app Node en el Paso 2, cPanel inyecta automáticamente en el `.htaccess` de la carpeta raíz del dominio un bloque similar a:
   ```apache
   # DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
   ...
   # DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END
   ```
2. Compilar el Frontend en local (`npm run build`) y subir el contenido de `dist/` a la carpeta raíz del dominio en **File Manager**.
3. Editar el `.htaccess` del servidor para pegar **debajo** del bloque de CloudLinux Passenger las reglas `<IfModule mod_rewrite.c>` de React Router (Sección 2.5), sin borrar el bloque de Passenger.

---

## 5. Actualización Automática CI/CD (GitHub Actions → HTTPS Puerto 443)

### 5.1 ¿Por qué usar HTTPS Puerto 443 (`deploy-hook.php`) y NO FTP (`21`) ni API cPanel (`2083`)?
En muchos proveedores de hosting empresarial en México y Latinoamérica (como EDR Networks sobre Google Cloud), el firewall del servidor aplica **bloqueo geográfico (Geo-IP)** sobre los puertos administrativos (`21` FTP, `22` SSH y `2083` cPanel), permitiendo conexiones a esos puertos únicamente desde IPs locales del país.

Como los runners de **GitHub Actions corren en centros de datos de EE. UU.**, cualquier intento de despliegue por FTP (`SamKirkland/FTP-Deploy-Action`, `lftp` o FTPS) o al puerto `2083` falla por **`TimeoutError`**. En cambio, el **puerto `443` (HTTPS)** del sitio web está abierto mundialmente.

Por ello, la arquitectura estándar, rápida y segura para cPanel consiste en colocar un receptor ligero **`deploy-hook.php`** en el propio dominio (`https://<tudominio.com>/deploy-hook.php`) autenticado mediante un token secreto verificado con **`SHA-256` (`hash_equals`)**.

---

### 5.2 Generar el `DEPLOY_TOKEN` y su Hash `SHA-256`
Ejecutar este comando en local para cada proyecto nuevo:

```powershell
node -e "const c=require('crypto'); const tok='Deploy_' + c.randomBytes(20).toString('base64url'); const hash=c.createHash('sha256').update(tok).digest('hex'); console.log('DEPLOY_TOKEN (guardar SOLO en GitHub Secrets):', tok); console.log('SHA256_HASH  (poner en deploy-hook.php):     ', hash);"
```

- **Regla de seguridad:** El valor `DEPLOY_TOKEN` **jamás** se escribe en ningún archivo ni comentario del código; únicamente se coloca el `SHA256_HASH` irreversible dentro de `deploy-hook.php`.

---

### 5.3 Receptor Seguro `Frontend/public/deploy-hook.php`
Al colocarlo dentro de `Frontend/public/deploy-hook.php`, Vite lo copia automáticamente a `dist/deploy-hook.php` en futuras compilaciones. Para el **primer enlace**, se sube una sola vez de forma manual al *Document Root* del dominio en cPanel.

> Solo debes cambiar `'backend_<proyecto>'` por el nombre exacto de la carpeta de tu Backend en cPanel y `$expectedHash` por el hash SHA-256 generado en el punto 5.2:

```php
<?php
// Receptor seguro de despliegue automático desde GitHub Actions vía HTTPS (Puerto 443)
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Hash SHA-256 irreversible del secret DEPLOY_TOKEN configurado en GitHub Actions
$expectedHash = '<PEGAR_AQUI_EL_SHA256_HASH>';
$providedToken = isset($_SERVER['HTTP_X_DEPLOY_TOKEN']) ? trim($_SERVER['HTTP_X_DEPLOY_TOKEN']) : '';

if ($providedToken === '' || !hash_equals($expectedHash, hash('sha256', $providedToken))) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Forbidden: Invalid deploy token']);
    exit;
}

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody, true);

if (!is_array($data) || empty($data['target']) || empty($data['files']) || !is_array($data['files'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid payload']);
    exit;
}

$target = $data['target'];
$baseDir = null;
$backendFolderName = 'backend_<proyecto>'; // Ejemplo: 'backend_etronic'

if ($target === 'frontend') {
    $baseDir = __DIR__;
} elseif ($target === 'backend') {
    // Autodetecta /home/<cuenta>/backend_<proyecto> tanto en dominio principal como en addon domain
    $candidates = [
        dirname(__DIR__, 1) . '/' . $backendFolderName,
        dirname(__DIR__, 2) . '/' . $backendFolderName,
        dirname(__DIR__, 3) . '/' . $backendFolderName,
    ];
    foreach ($candidates as $candidate) {
        if (is_dir($candidate)) {
            $baseDir = $candidate;
            break;
        }
    }
} else {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Unknown target']);
    exit;
}

if ($baseDir === null || !is_dir($baseDir)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Target directory not found']);
    exit;
}

$written = [];
foreach ($data['files'] as $relPath => $b64Content) {
    $cleanPath = ltrim(str_replace('\\', '/', (string) $relPath), '/');
    // Lista negra estricta: protege configuración del servidor, credenciales y otros recursos
    if (
        $cleanPath === '' ||
        strpos($cleanPath, '..') !== false ||
        $cleanPath === '.htaccess' ||
        (strpos($cleanPath, '.env') === 0 && $cleanPath !== '.env.example') ||
        strpos($cleanPath, 'api') === 0 && strpos($cleanPath, '/') !== false && explode('/', $cleanPath)[0] === 'api<proyecto>' ||
        strpos($cleanPath, '.well-known/') === 0 ||
        strpos($cleanPath, 'cgi-bin/') === 0 ||
        strpos($cleanPath, 'node_modules/') === 0 ||
        strpos($cleanPath, 'data/') === 0 ||
        $cleanPath === '.user.ini' ||
        $cleanPath === 'php.ini'
    ) {
        continue;
    }

    $fullPath = $baseDir . '/' . $cleanPath;
    $dirPath = dirname($fullPath);
    if (!is_dir($dirPath)) {
        mkdir($dirPath, 0755, true);
    }

    $decoded = base64_decode((string) $b64Content, true);
    if ($decoded !== false) {
        file_put_contents($fullPath, $decoded);
        $written[] = $cleanPath;
    }
}

// Si se desplegó el Backend, reiniciar Phusion Passenger automáticamente sin SSH
if ($target === 'backend') {
    $tmpDir = $baseDir . '/tmp';
    if (!is_dir($tmpDir)) {
        @mkdir($tmpDir, 0755, true);
    }
    $restartFile = $tmpDir . '/restart.txt';
    @file_put_contents($restartFile, gmdate('c') . "\n");
    @touch($restartFile);
}

echo json_encode([
    'ok' => true,
    'target' => $target,
    'updated_files' => count($written),
    'files' => $written,
]);
```

---

### 5.4 Workflow de GitHub Actions para Frontend (`Frontend/.github/workflows/deploy-cpanel.yml`)

Puntos técnicos clave incluidos en este workflow:
- **`concurrency`:** Evita que dos `push` seguidos compitan subiendo archivos al mismo tiempo.
- **Lotes Base64 de `2.5 MB`:** Evita superar `post_max_size = 8M` de PHP en cPanel y evita falsos bloqueos de ModSecurity sobre código JS/HTML.
- **`index.html` se sube al final:** Garantiza que todos los nuevos hashes JS/CSS en `assets/` ya existan en disco antes de actualizar `index.html`.
- **Verificación estricta `parsed.ok === true`:** Si `deploy-hook.php` aún no se hubiera subido a cPanel, Apache devolvería `index.html` con `HTTP 200`; validar `JSON.parse` + `parsed.ok === true` impide falsos positivos.

```yaml
name: Build & Deploy Frontend to cPanel

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: deploy-frontend-cpanel
  cancel-in-progress: false

jobs:
  build-and-deploy:
    name: Compilar y publicar en cPanel (HTTPS 443)
    runs-on: ubuntu-latest

    steps:
      - name: 1. Descargar código fuente
        uses: actions/checkout@v4

      - name: 2. Configurar Node.js 24
        uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"

      - name: 3. Instalar dependencias
        run: npm ci

      - name: 4. Verificar formato, linter y tipos (si usa Vite+)
        run: npm run check

      - name: 5. Compilar bundle de producción (dist/)
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
        run: npm run build

      - name: 6. Publicar dist/ vía HTTPS (Puerto 443)
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
        run: |
          node - << 'EOF'
          const fs = require("fs");
          const path = require("path");

          const DEPLOY_URL = "https://<tudominio.com>/deploy-hook.php";
          const distDir = path.resolve("dist");
          const files = {};

          function walk(dir) {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                walk(full);
              } else {
                const rel = path.relative(distDir, full).replace(/\\/g, "/");
                if (rel === ".htaccess") continue;
                files[rel] = fs.readFileSync(full).toString("base64");
              }
            }
          }
          walk(distDir);

          (async () => {
            const token = (process.env.DEPLOY_TOKEN || "").trim();
            if (!token) {
              console.error("Falta configurar el secret DEPLOY_TOKEN en GitHub.");
              process.exit(1);
            }

            const entries = Object.entries(files);
            entries.sort(([a], [b]) => (a === "index.html" ? 1 : 0) - (b === "index.html" ? 1 : 0));

            const MAX_BATCH_BYTES = 2.5 * 1024 * 1024;
            const batches = [];
            let currentBatch = {};
            let currentBytes = 0;

            for (const [relPath, b64] of entries) {
              const itemBytes = relPath.length + b64.length + 16;
              if (currentBytes + itemBytes > MAX_BATCH_BYTES && Object.keys(currentBatch).length > 0) {
                batches.push(currentBatch);
                currentBatch = {};
                currentBytes = 0;
              }
              currentBatch[relPath] = b64;
              currentBytes += itemBytes;
            }
            if (Object.keys(currentBatch).length > 0) batches.push(currentBatch);

            for (let i = 0; i < batches.length; i++) {
              const res = await fetch(DEPLOY_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Deploy-Token": token,
                },
                body: JSON.stringify({ target: "frontend", files: batches[i] }),
              });
              const text = await res.text();
              console.log(`Lote ${i + 1}/${batches.length} HTTP ${res.status}:`, text);
              let parsed = null;
              try { parsed = JSON.parse(text); } catch { process.exit(1); }
              if (!res.ok || !parsed || parsed.ok !== true) process.exit(1);
            }
          })();
          EOF
```

> **Importante si el Frontend usa Vite+ (`vp check` / `oxfmt`):** `vp check` revisa también el formato de `.github/workflows/*.yml`. Siempre ejecutar `npm run fmt` y `npm run check` en `Frontend/` después de crear o editar el archivo YAML antes de hacer commit.

---

### 5.5 Workflow de GitHub Actions para Backend (`Backend/.github/workflows/deploy-cpanel.yml`)

```yaml
name: Validate & Deploy Backend to cPanel

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: deploy-backend-cpanel
  cancel-in-progress: false

jobs:
  validate-and-deploy:
    name: Validar sintaxis Node y desplegar en cPanel (HTTPS 443)
    runs-on: ubuntu-latest

    steps:
      - name: 1. Descargar código fuente
        uses: actions/checkout@v4

      - name: 2. Configurar Node.js 24
        uses: actions/setup-node@v4
        with:
          node-version: "24"

      - name: 3. Verificar sintaxis de todos los módulos del Backend
        run: |
          node --check index.js
          node --check loader.cjs
          find src scripts -type f \( -name "*.js" -o -name "*.mjs" -o -name "*.cjs" \) -exec node --check {} +

      - name: 4. Enviar archivos de Backend y reiniciar Passenger vía HTTPS (Puerto 443)
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
        run: |
          node - << 'EOF'
          const fs = require("fs");
          const path = require("path");

          const DEPLOY_URL = "https://<tudominio.com>/deploy-hook.php";
          const rootDir = process.cwd();
          const files = {};
          const includeFiles = ["package.json", "package-lock.json", "loader.cjs", "index.js", ".env.example"];
          const includeDirs = ["src", "scripts"];

          for (const f of includeFiles) {
            const full = path.join(rootDir, f);
            if (fs.existsSync(full)) files[f] = fs.readFileSync(full).toString("base64");
          }

          function walk(dir) {
            if (!fs.existsSync(dir)) return;
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                walk(full);
              } else {
                const rel = path.relative(rootDir, full).replace(/\\/g, "/");
                files[rel] = fs.readFileSync(full).toString("base64");
              }
            }
          }
          includeDirs.forEach((d) => walk(path.join(rootDir, d)));

          files["tmp/restart.txt"] = Buffer.from(
            `Deployed commit ${process.env.GITHUB_SHA || "manual"} at ${new Date().toISOString()}\n`
          ).toString("base64");

          (async () => {
            const token = (process.env.DEPLOY_TOKEN || "").trim();
            if (!token) {
              console.error("Falta configurar el secret DEPLOY_TOKEN en GitHub.");
              process.exit(1);
            }

            const entries = Object.entries(files);
            const MAX_BATCH_BYTES = 2.5 * 1024 * 1024;
            const batches = [];
            let currentBatch = {};
            let currentBytes = 0;

            for (const [relPath, b64] of entries) {
              const itemBytes = relPath.length + b64.length + 16;
              if (currentBytes + itemBytes > MAX_BATCH_BYTES && Object.keys(currentBatch).length > 0) {
                batches.push(currentBatch);
                currentBatch = {};
                currentBytes = 0;
              }
              currentBatch[relPath] = b64;
              currentBytes += itemBytes;
            }
            if (Object.keys(currentBatch).length > 0) batches.push(currentBatch);

            for (let i = 0; i < batches.length; i++) {
              const res = await fetch(DEPLOY_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Deploy-Token": token,
                },
                body: JSON.stringify({ target: "backend", files: batches[i] }),
              });
              const text = await res.text();
              console.log(`Lote ${i + 1}/${batches.length} HTTP ${res.status}:`, text);
              let parsed = null;
              try { parsed = JSON.parse(text); } catch { process.exit(1); }
              if (!res.ok || !parsed || parsed.ok !== true) process.exit(1);
            }
          })();
          EOF
```

> **Nota sobre dependencias nuevas en Backend:** Para cualquier cambio de código, rutas, controladores o esquemas todo es 100% automático. Únicamente cuando se agregue una **librería nueva** al `package.json` del Backend será necesario entrar una vez a *Setup Node.js App* en cPanel y pulsar **Run NPM Install**.

---

## 6. Catálogo de Incidentes Reales Encontrados y Cómo Evitarlos

| Síntoma / Error | Causa Raíz | Solución Definitiva |
| :--- | :--- | :--- |
| **`ERR_REQUIRE_ASYNC_MODULE`** al iniciar Node en cPanel | Passenger usa `require()` CommonJS sobre un proyecto `"type": "module"` con `top-level await`. | Usar `loader.cjs` como *Application startup file* haciendo `import("./index.js")`. |
| **`"Usuario no encontrado"`** o variables `.env` vacías en Passenger | Passenger inicia con un `cwd` distinto a la carpeta de la app o el usuario PostgreSQL no fue vinculado a la BD. | Cargar `dotenv.config({ path: path.join(__dirname, ".env") })` en `loader.cjs` y ejecutar **Add User to Database** en cPanel. |
| **`code 28000: no pg_hba.conf entry for host "::1", user " ..."`** | Node 20+/24 resuelve `localhost` a IPv6 (`::1`) y/o se pegó un espacio inicial en `DB_USER` en cPanel. | En `db.js`, aplicar `.trim()` a todas las variables `DB_*` y convertir `localhost` / `::1` a IPv4 `127.0.0.1`. |
| **`HTTP 401 / Requested page: 403.shtml`** en phpPgAdmin al crear tablas | El firewall WAF **ModSecurity** de cPanel bloquea texto SQL (`CREATE TABLE`, `INSERT`) enviado por formulario. | Subir archivo `.sql` o pausar **ModSecurity** 1 minuto en *cPanel → Security → ModSecurity*, ejecutar el SQL y reactivarlo. |
| **`permission denied for sequence <tabla>_<id>_seq`** al insertar registros (Chat o nuevos usuarios) | En cPanel PostgreSQL, *Add User to Database* da permisos sobre tablas pero NO siempre sobre las secuencias `SERIAL` creadas desde phpPgAdmin. | Ejecutar siempre al final del `.sql`: `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;` |
| **`Error: Timeout (control socket)`** al desplegar por FTP desde GitHub Actions | El hosting bloquea por Geo-IP los puertos `21` (FTP) y `2083` (cPanel) para IPs fuera del país (runners en EE. UU.). | Desplegar por **HTTPS Puerto 443** usando `deploy-hook.php` + `X-Deploy-Token` (SHA-256). |
| **Falla inmediata de GitHub Actions con 0 jobs** al usar `if: ${{ secrets.X != '' }}` | El parser de GitHub Actions no permite el contexto `secrets` dentro del `if:` de un `step`. | Pasar el secret mediante `env:` del step y validarlo dentro del script. |
| **Falso positivo `HTTP 200`** al llamar `deploy-hook.php` antes de subirlo | Si `deploy-hook.php` aún no existe en el servidor, `.htaccess` redirige la petición a `index.html` devolviendo `200 OK`. | Validar siempre en el workflow `JSON.parse(text)` y `parsed.ok === true`, además de probar `GET /deploy-hook.php` (`HTTP 405`). |
| **Hash `bcrypt` inválido al generarlo con `node -e` en PowerShell** | PowerShell altera comillas internas o caracteres como `#` y `$` en comandos inline. | Generar el hash desde un script `.mjs` en archivo o desde el formulario de la app. |

---

## 7. Checklist Exprés en 10 Pasos para Futuros Proyectos

1. **Código Backend:** Incluir `loader.cjs` (con `dotenv` por `__dirname`), `db.js` (con `127.0.0.1`, `.trim()` y sin SSL en localhost) y doble montaje `["/api<proyecto>", "/"]` + `/api<proyecto>/health` en `app.js`.
2. **Código Frontend:** Configurar `axios.js` con `baseURL: import.meta.env.PROD ? "/api<proyecto>" : "http://localhost:3000/api<proyecto>"` y crear `Frontend/public/.htaccess`.
3. **Generar Token CI/CD:** Generar `DEPLOY_TOKEN` aleatorio + su hash `SHA-256`; pegar **solo el hash** en `Frontend/public/deploy-hook.php` apuntando a `backend_<proyecto>`.
4. **Workflows CI/CD:** Crear `Frontend/.github/workflows/deploy-cpanel.yml` y `Backend/.github/workflows/deploy-cpanel.yml` apuntando a `https://<tudominio.com>/deploy-hook.php` *(ejecutar `npm run fmt` y `npm run check` si se usa Vite+)*.
5. **Auditoría de seguridad:** Verificar `0` contraseñas o tokens en texto plano antes de subir ambos repositorios a GitHub (`main`).
6. **cPanel PostgreSQL:** Crear BD + Usuario → **Add User to Database** → importar `.sql` inicial en phpPgAdmin.
7. **cPanel Node.js App:** Crear aplicación en `backend_<proyecto>`, URL `/api<proyecto>`, startup `loader.cjs`, subir paquete inicial, correr **Run NPM Install**, configurar variables de entorno y dar **Restart**.
8. **cPanel Frontend + Hook:** Subir `dist/` inicial (incluyendo `deploy-hook.php`) al *Document Root* del dominio y añadir las reglas SPA al `.htaccess` **debajo** del bloque de CloudLinux Passenger.
9. **GitHub Secrets:** En ambos repositorios (`Settings → Secrets and variables → Actions`), registrar `DEPLOY_TOKEN` con el token generado en el paso 3.
10. **Verificación final:** Confirmar `GET https://<tudominio.com>/deploy-hook.php` (`405`), hacer un `git push` de prueba y verificar ambos checks en verde (`✓`) + `GET https://<tudominio.com>/api<proyecto>/health` (`200 {"ok":true,"dbConnected":true}`).
