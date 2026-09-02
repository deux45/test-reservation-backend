# Shared Resource Booking System — Plan de Implementación

Prueba técnica · Backend Developer
Backend: NestJS + PostgreSQL + TypeORM · Frontend: Next.js + React + MUI

---

> **Convención de idioma.** Todo el código, identificadores, nombres de fichero, rutas
> de la API, esquema de base de datos, mensajes de log y comentarios están en **inglés**.
> Únicamente los textos visibles al usuario en el frontend —labels, botones, mensajes de
> error, títulos— van en **español**. Esta guía está redactada en español porque el
> enunciado de la prueba lo está.

> **Versiones verificadas el 2026-09-01** contra el registro de npm, la base de datos de
> vulnerabilidades OSV.dev y los Dockerfiles oficiales de `docker-library/postgres`.
> Ver §2 para la metodología y §1 para la tabla completa.

---

## Índice

- [0. Decisiones fundacionales](#0-decisiones-fundacionales)
- [1. Stack y versiones verificadas](#1-stack-y-versiones-verificadas)
- [2. Seguridad de la cadena de suministro](#2-seguridad-de-la-cadena-de-suministro)
- [3. Backend](#3-backend)
- [4. Frontend](#4-frontend)
- [5. Entrega: Docker, versionado y CI/CD](#5-entrega-docker-versionado-y-cicd)
- [6. Estrategia de pruebas](#6-estrategia-de-pruebas)
- [7. Plan por fases](#7-plan-por-fases)
- [8. Documento reflexivo](#8-documento-reflexivo)
- [9. Checklist de entrega](#9-checklist-de-entrega)

---

## 0. Decisiones fundacionales

| Decisión                  | Elección                                                                                                        | Por qué                                                                                                              | Descartado                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dónde vive la invariante  | **PostgreSQL**, `EXCLUDE USING gist`                                                                            | Único punto por el que pasan todas las escrituras. Ninguna réplica ni script puede violarla.                         | Validar solo en el servicio: se rompe con dos instancias.                                                                                                            |
| Semántica del intervalo   | **Semiabierto `[start, end)`**                                                                                  | 10:00–11:00 y 11:00–12:00 son contiguas, no conflictivas.                                                            | Cerrado `[]`: haría chocar reservas consecutivas.                                                                                                                    |
| Concurrencia              | **Advisory lock por recurso** + constraint                                                                      | Serializa solo el mismo recurso. Permite un 409 con datos útiles.                                                    | `SERIALIZABLE`: obliga a bucles de reintento.                                                                                                                        |
| Tipos de recurso          | **Una tabla + `jsonb` validado con JSON Schema**                                                                | Añadir "vehículo" es insertar una fila, no desplegar código.                                                         | Tabla por tipo o herencia: rompe las consultas transversales.                                                                                                        |
| Estilo de capas           | **Módulo por dominio con carpetas planas** (`controllers/`, `dtos/`, `entities/`, `repositories/`, `services/`) | Convención estándar de NestJS. Se navega sin mapa.                                                                   | Hexagonal con `domain/application/infrastructure`: triplica ficheros sin añadir garantías a esta escala (§3.1).                                                      |
| Autenticación             | **Better Auth tras un adaptador propio** (§3.10), mismo Postgres, sesión por cookie                             | Un proveedor de identidad para API y front, detrás de un puerto de dos métodos. Sustituirlo cuesta 1 fichero, no 45. | El paquete comunitario `@thallesp/nestjs-better-auth`: son 40 líneas propias las que ahorra, y a cambio mete una dependencia no oficial en la ruta de autenticación. |
| Zona horaria              | **`timestamptz` siempre**; TZ del recurso solo para calcular                                                    | UTC en disco elimina los bugs de horario de verano.                                                                  | `timestamp` sin zona.                                                                                                                                                |
| Versiones de dependencias | **Cooldown de 7 días** sobre la última estable                                                                  | Todos los incidentes de 2025–2026 se detectaron en < 7 días.                                                         | Instalar `latest`: es exactamente el vector de ataque.                                                                                                               |

**Principio rector.** El enunciado dice: _"preferimos un sistema simple y sólido antes que
uno ambicioso y roto"_. Este diseño concentra su complejidad en la creación de reservas y
mantiene todo lo demás deliberadamente aburrido. Reservas recurrentes y notificaciones
quedan **fuera de alcance**, y eso se justifica en el documento reflexivo.

---

## 1. Stack y versiones verificadas

Consultado al registro de npm el **2026-09-01**. La columna _Edad_ es días desde su
publicación; la columna **Pin** es la versión a fijar aplicando el cooldown de 7 días (§2).

### 1.1 Backend

| Paquete                                                      | Última  |      Edad | **Pin**           |
| ------------------------------------------------------------ | ------- | --------: | ----------------- |
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` | 12.0.1  |        4d | **11.2.1**        |
| `@nestjs/config`                                             | 12.0.0  |        4d | **4.0.4**         |
| `@nestjs/swagger`                                            | 12.0.1  |        3d | **11.4.7**        |
| `@nestjs/typeorm`                                            | 12.0.1  |        3d | **11.0.3**        |
| `@nestjs/terminus`                                           | 12.0.0  |        0d | **11.1.1**        |
| `typeorm`                                                    | 1.1.0   |       49d | **1.1.0**         |
| `pg`                                                         | 8.23.0  |       23d | **8.23.0**        |
| `better-auth`                                                | 1.7.2   |        5d | **1.7.1**         |
| ~~`@thallesp/nestjs-better-auth`~~                           | 2.7.0   |       58d | **descartado** ⚠️ |
| `class-validator`                                            | 0.15.1  |      186d | **0.15.1**        |
| `class-transformer`                                          | 0.5.1   | **1743d** | **0.5.1** ⚠️      |
| `ajv`                                                        | 8.20.0  |      129d | **8.20.0**        |
| `zod`                                                        | 4.5.4   |        2d | **4.4.3**         |
| `nestjs-pino`                                                | 5.0.0   |        0d | **4.6.1**         |
| `pino`                                                       | 10.3.1  |      203d | **10.3.1**        |
| `typescript`                                                 | 7.0.2   |       54d | **6.0.3** ⚠️      |
| `jest`                                                       | 30.5.0  |        3d | **30.4.2**        |
| `ts-jest`                                                    | 29.4.12 |       40d | **29.4.12**       |
| `supertest`                                                  | 7.2.2   |      237d | **7.2.2**         |
| `testcontainers`, `@testcontainers/postgresql`               | 12.1.0  |       27d | **12.1.0**        |
| `eslint`                                                     | 10.9.1  |        7d | **10.9.1**        |
| `prettier`                                                   | 3.9.6   |       41d | **3.9.6**         |
| `husky`                                                      | 9.1.7   |      651d | **9.1.7**         |
| `lint-staged`                                                | 17.4.1  |        4d | **17.3.0**        |
| `@faker-js/faker`                                            | 10.6.0  |       17d | **10.6.0**        |
| `reflect-metadata`                                           | 0.2.2   |      886d | **0.2.2**         |
| `rxjs`                                                       | 7.8.2   |      556d | **7.8.2**         |
| `date-fns`                                                   | 4.4.0   |       94d | **4.4.0**         |

> ⚠️ **TypeScript 7 rompe el build. Se fija la 6.0.3.** El compilador nativo (tsgo) _sí_
> emite `experimentalDecorators` y `emitDecoratorMetadata`, así que el `design:paramtypes`
> que lee el inyector de Nest sigue existiendo. El problema es otro: **TypeScript 7 no
> expone API programática de compilador**, y `nest build`, `ts-jest`, `ts-loader` y
> `typescript-eslint` importan el paquete `typescript` y llaman a `createProgram()`.
> Verificado al construir: con la 6.0.3 compila; la 7 no es una opción hasta que NestJS
> publique soporte de tsgo.
>
> Efecto secundario de la 6.x, también verificado: deprecó `moduleResolution: "node10"` y
> `baseUrl`, y ahora **exige `rootDir` explícito**. Sin él el build emite `dist/src/main.js`
> en vez de `dist/main.js` y rompe en silencio el `CMD` del Dockerfile.

> ⚠️ **El frontend va con TypeScript 5.9.3, no 6.0.3.** `openapi-typescript` declara
> `peer typescript ^5.x` en todas sus versiones e importa el compilador directamente, así
> que `npm install` falla con la 6. La API necesita la 6 por lo de arriba; el cliente no
> necesita nada de la 6. Dos versiones distintas con una razón concreta cada una, anotadas
> en el `package.json` del front.

> ⚠️ **`@thallesp/nestjs-better-auth` se descarta.** Es un paquete comunitario, no oficial,
> y estaría en la ruta de autenticación de todas las peticiones. Lo único que aporta es un
> controlador y un guard que de todas formas hay que escribir para tener el adaptador de
> §3.10 &mdash;unas 40 líneas&mdash;. Quitarlo elimina una dependencia de terceros **y** deja
> el punto de sustitución del proveedor: mejora en las dos direcciones. `better-auth` sí se
> usa, directamente y solo dentro de `src/auth/providers/`.

> **NestJS 12 se publicó hace 4 días.** Fijar un _major_ de esa edad en un entregable que
> te van a evaluar es un riesgo innecesario por dos motivos independientes: la ventana de
> cooldown y la ausencia de guías de migración maduras. **Se fija NestJS 11.2.1**, que es
> la última de una rama estable y probada. Es una decisión que conviene explicar en el
> README: elegir deliberadamente _no_ la última demuestra criterio, no desactualización.

> ⚠️ **`class-transformer` lleva 1743 días sin publicar** (última: 0.5.1, nov-2021). Es una
> dependencia de facto de `class-validator` y del `ValidationPipe` de NestJS. No hay CVE
> abierto (§2.2), pero un paquete sin mantenimiento en la ruta de deserialización de toda
> petición es una deuda que hay que **nombrar** en el documento reflexivo. Mitigación
> aplicada: `whitelist: true` y `forbidNonWhitelisted: true` en el `ValidationPipe`, de
> modo que ninguna propiedad no declarada llega jamás al dominio.

### 1.2 Frontend

| Paquete                                   | Última            |        Edad | **Pin**               |
| ----------------------------------------- | ----------------- | ----------: | --------------------- |
| `next`                                    | 16.3.4            |          0d | **16.3.2**            |
| `react`, `react-dom`                      | 19.2.8            |         41d | **19.2.8**            |
| `@mui/material`, `@mui/material-nextjs`   | 9.4.0             |          4d | **9.3.1 / 9.3.0**     |
| `@mui/x-data-grid`, `@mui/x-date-pickers` | 9.12.0            |         10d | **9.12.0**            |
| `@emotion/react` / `@emotion/styled`      | 11.14.0 / 11.14.1 | 630d / 431d | **11.14.0 / 11.14.1** |
| `@tanstack/react-query`                   | 5.102.8           |          4d | **5.102.3**           |
| `react-hook-form`                         | 7.87.0            |          2d | **7.86.0**            |
| `@hookform/resolvers`                     | 5.9.1             |         14d | **5.9.1**             |
| `zod`                                     | 4.5.4             |          2d | **4.4.3**             |
| `openapi-typescript` / `openapi-fetch`    | 7.13.0 / 0.17.0   |        201d | **7.13.0 / 0.17.0**   |
| `date-fns` / `@date-fns/tz`               | 4.4.0 / 1.5.0     |  94d / 102d | **4.4.0 / 1.5.0**     |
| `better-auth`                             | 1.7.2             |          5d | **1.7.1**             |
| `vitest`                                  | 4.1.11            |         13d | **4.1.11**            |
| `@vitejs/plugin-react`                    | 6.1.1             |          4d | **6.1.0**             |
| `@testing-library/react`                  | 16.3.3            |          4d | **16.3.2**            |
| `@testing-library/user-event`             | 14.6.6            |         10d | **14.6.6**            |
| `@testing-library/jest-dom`               | 7.0.1             |         22d | **7.0.1**             |
| `jsdom`                                   | 30.0.1            |         34d | **30.0.1**            |
| `msw`                                     | 2.15.0            |         55d | **2.15.0**            |
| `@playwright/test`                        | 1.62.1            |         32d | **1.62.1**            |
| `eslint-config-next`                      | 16.3.4            |          0d | **16.3.2**            |

**Importante:** `better-auth` debe ser **exactamente la misma versión** en backend y
frontend. El cliente y el servidor comparten tipos inferidos y formato de sesión.

### 1.3 Runtime e imágenes base

| Componente | Versión                       | Verificación                                                                                     |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| Node.js    | **24 LTS** (`node:24-alpine`) | Active LTS hasta 2028-04-30, según `nodejs/Release/schedule.json`. Node 26 es _Current_, no LTS. |
| PostgreSQL | **18** (`postgres:18-alpine`) | 18.6 es la última estable (2026-08-11). PG 19 está en Beta 3: no se usa.                         |
| Adminer    | `adminer:5`                   | Solo en desarrollo.                                                                              |
| npm        | **≥ 11.10.0**                 | Requisito para `min-release-age` (§2.3).                                                         |

> 🔴 **Cambio de ruta en PostgreSQL 18.** Verificado en el Dockerfile oficial:
>
> ```
> ENV PGDATA /var/lib/postgresql/18/docker
> VOLUME /var/lib/postgresql
> ```
>
> Hasta PG 17 el volumen era `/var/lib/postgresql/data`. Un `docker-compose.yml` copiado de
> cualquier tutorial anterior monta la ruta equivocada y **los datos no persisten entre
> reinicios**. Los ficheros de §5 usan la ruta correcta.

---

## 2. Seguridad de la cadena de suministro

Los ataques a paquetes de npm dejaron de ser hipotéticos: el gusano _Shai-Hulud_
(nov-2025) llegó a 796 paquetes con 132 M de descargas mensuales combinadas, y solo en
2026 se encadenaron _Glassworm_, la manipulación de `Trivy` v0.69.4, `LiteLLM` 1.82.7/8 y
`axios` 1.14.1 / 0.30.4. Este apartado no es decorativo: es parte del diseño.

### 2.1 Qué se puede verificar de verdad, y qué no

Conviene ser preciso sobre el alcance, porque prometer más de lo que se puede comprobar es
peor que no comprobar nada.

| Se puede                                                                               | No se puede                                                    |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Consultar cada versión exacta contra bases de vulnerabilidades (OSV, GitHub Advisory). | Garantizar que un paquete limpio hoy no se comprometa mañana.  |
| Verificar firmas y procedencia (_provenance_) del registro.                            | Auditar manualmente el código de 900 dependencias transitivas. |
| Bloquear los vectores conocidos (scripts de instalación, versiones recién publicadas). | Detectar un _zero-day_ aún no reportado por nadie.             |
| Congelar el árbol completo con un lockfile e instalar solo desde él.                   | Afirmar "está libre de virus" con certeza absoluta.            |

La estrategia correcta no es _afirmar_ que está limpio: es **reducir la ventana de
exposición** y **hacer el fallo detectable**.

### 2.2 Verificación ejecutada (2026-09-01)

Las 55 dependencias directas, en sus versiones exactas, consultadas contra la API de
[OSV.dev](https://osv.dev) (Google Open Source Vulnerabilities):

```
--- 55 paquetes consultados en OSV.dev | 0 con vulnerabilidades conocidas ---
```

Este chequeo debe ser **reproducible y automatizado**, no un acto puntual. Se incluye como
script del repositorio:

```jsonc
// package.json
{
  "scripts": {
    "audit:osv": "node scripts/osv-check.mjs",
    "audit:signatures": "npm audit signatures",
    "audit:vulns": "npm audit --audit-level=high",
  },
}
```

`npm audit signatures` verifica que cada tarball descargado coincide con la firma del
registro y, cuando existe, con su atestación de procedencia (_provenance_): confirma que el
paquete se construyó en el pipeline público que declara, no en el portátil de alguien.

### 2.3 Cooldown de dependencias — la defensa que sí habría parado los incidentes

Los ataques reales duran poco. `axios` tuvo versiones maliciosas vivas ~3 horas
(marzo 2026); `TanStack Router` se detectó en minutos y se deprecó en ~1,5 h. Instalar
únicamente versiones con **al menos 7 días de vida** habría bloqueado _todos_ los
incidentes de 2025–2026.

`npm` incorporó `min-release-age` **en días** desde la versión 11.10.0 (febrero 2026):

```ini
# .npmrc — idéntico en backend y frontend

# No instalar versiones publicadas hace menos de 7 días.
# Requiere npm >= 11.10.0. Es la única línea de este fichero que habría
# bloqueado Shai-Hulud, Glassworm y los incidentes de axios y LiteLLM.
min-release-age=7

# Los scripts de ciclo de vida (preinstall/postinstall) son el vector de
# ejecución de todos los gusanos de npm conocidos. Se desactivan globalmente.
ignore-scripts=true

# Versiones exactas: nada de ^ ni ~. El lockfile manda.
save-exact=true
package-lock=true

audit-level=high
fund=false
```

> **Consecuencia asumida y visible.** Bajo esta política, 20 de las 55 dependencias se
> fijan a una versión que **no** es la última (§1). Es intencional. Si algún paquete
> necesitase de verdad su script de instalación, se rehabilita uno a uno con
> `npm rebuild <paquete>` en el Dockerfile, nunca quitando `ignore-scripts` globalmente.
> En este stack ninguno lo necesita: no hay dependencias nativas.

### 2.4 Capas restantes

| Capa              | Medida                                                                           | Fichero                    |
| ----------------- | -------------------------------------------------------------------------------- | -------------------------- |
| Instalación       | `npm ci` siempre; nunca `npm install` en CI ni en Docker.                        | `Dockerfile`, CI           |
| Lockfile          | `package-lock.json` versionado y revisado en cada PR.                            | repo                       |
| Aislamiento       | `--ignore-scripts` en todas las capas de build.                                  | `Dockerfile`               |
| Imágenes          | Tag y **digest** fijados en producción: `postgres:18-alpine@sha256:…`            | `docker-compose.prod.yml`  |
| Escaneo de imagen | Trivy sobre la imagen final en CI, fallo con severidad ≥ HIGH.                   | `.github/workflows/ci.yml` |
| SBOM              | `docker buildx build --sbom=true --provenance=true`.                             | CI                         |
| Runtime           | Contenedor `read_only`, usuario no root, `cap_drop: [ALL]`, `no-new-privileges`. | `docker-compose.prod.yml`  |
| Actualizaciones   | Dependabot con `cooldown` de 7 días alineado con `.npmrc`.                       | `.github/dependabot.yml`   |
| Secretos          | Nunca en `docker-compose`; `secrets:` de Docker o el gestor del proveedor.       | §5.3                       |

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: '/'
    schedule: { interval: weekly }
    # Alineado con min-release-age del .npmrc: Dependabot no propone
    # una versión antes de que el ecosistema haya tenido tiempo de detectarla.
    cooldown:
      default-days: 7
    open-pull-requests-limit: 5
```

### 2.5 CI de seguridad

```yaml
# .github/workflows/ci.yml (extracto — el fichero completo está en el repositorio)
security:
  name: Supply chain
  runs-on: ubuntu-latest
  steps:
    # Fijadas por SHA de commit, NO por tag. Los tags son mutables, y repuntar
    # uno es exactamente cómo el compromiso de tj-actions/changed-files llegó a
    # miles de repositorios. El comentario deja la versión legible y permite que
    # Dependabot actualice SHA y comentario a la vez.
    - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
    - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
      with: { node-version: '24', cache: npm }

    - run: npm ci --ignore-scripts
    - run: npm run audit:signatures # firmas y procedencia del registro
    - run: npm run audit:vulns # GitHub Advisory Database
    - run: npm run audit:osv # segunda fuente independiente

    - uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
      with:
        image-ref: reservations-api:${{ github.sha }}
        severity: HIGH,CRITICAL
        ignore-unfixed: true
        exit-code: '1'
```

> **Nunca `@master` ni `@v7` en una action.** Un tag flotante entrega, en cada ejecución,
> el código que el propietario del repositorio decida en ese momento; el SHA es inmutable.
> Es la misma lógica que fija el digest de las imágenes Docker (§5.2) y que impone el
> cooldown del `.npmrc`: **reducir a cero la ventana en la que un cambio ajeno entra en tu
> build sin que nadie lo apruebe.** Las actions de este proyecto están resueltas a SHA
> con fecha 2026-09-01; la tabla completa está en §5.6.

---

## 3. Backend

### 3.1 Arquitectura

Monolito modular con **módulo por dominio** y carpetas planas por tipo de artefacto
(`controllers/`, `dtos/`, `entities/`, `repositories/`, `services/`). Es la convención
estándar de NestJS: cualquiera que abra el repositorio sabe dónde está todo sin
necesidad de un mapa.

Dos módulos de dominio: **`resources`** (qué se puede reservar) y **`reservations`**
(quién lo reserva y cuándo).

```
src/
├── main.ts                        # bodyParser:false (Better Auth), CORS, Swagger, pipes
├── app.module.ts
├── config/
│   ├── env.validation.ts          # validación de entorno con zod al arrancar
│   └── swagger.config.ts          # DocumentBuilder + SwaggerModule.setup (§3.9)
├── common/
│   ├── decorators/                # current-user.decorator.ts, roles.decorator.ts
│   ├── dtos/                      # pagination-query.dto.ts, paginated-response.dto.ts
│   ├── filters/                   # problem-details.filter.ts — RFC 7807 para toda excepción
│   ├── interfaces/                # pagination.interface.ts
│   └── utils/                     # paginate.util.ts, intervals.util.ts, pg-error.util.ts
├── database/
│   ├── data-source.ts             # DataSource de TypeORM para el CLI de migraciones
│   ├── migrations/
│   └── seeds/
├── auth/                          # el ÚNICO módulo que conoce al proveedor de identidad
│   ├── ports/                     # auth-provider.port.ts (AuthProvider, AuthenticatedUser)
│   ├── providers/                 # better-auth · jwt · fake (para los e2e)
│   ├── guards/                    # authentication.guard.ts, roles.guard.ts
│   ├── decorators/                # current-user · public · roles
│   ├── auth.controller.ts         # @All('api/auth/*splat') -> provider.getRequestHandler()
│   └── auth.module.ts             # forRoot(): elige proveedor por AUTH_PROVIDER
├── resources/                     # qué se puede reservar
│   ├── controllers/               # resource-types.controller.ts
│   │                              # resources.controller.ts
│   │                              # resource-blocks.controller.ts
│   ├── dtos/                      # create-resource.dto.ts, update-resource.dto.ts,
│   │                              # filter-resources.dto.ts, resource.dto.ts
│   ├── entities/                  # resource-type.entity.ts, resource.entity.ts,
│   │                              # resource-availability.entity.ts, resource-block.entity.ts
│   ├── repositories/              # resource.repository.ts, resource-type.repository.ts
│   ├── services/                  # resource.service.ts, resource-type.service.ts,
│   │                              # resource-attributes.service.ts (ajv contra el JSON Schema)
│   └── resources.module.ts
├── reservations/                  # quién reserva y cuándo
│   ├── controllers/               # reservations.controller.ts, availability.controller.ts
│   ├── dtos/                      # create-reservation.dto.ts, filter-reservations.dto.ts,
│   │                              # cancel-reservation.dto.ts, reservation.dto.ts
│   ├── entities/                  # reservation.entity.ts
│   ├── enums/                     # reservation-status.enum.ts
│   ├── repositories/              # reservation.repository.ts
│   ├── rules/                     # reservation-rule.interface.ts + una clase por regla
│   ├── services/                  # reservation.service.ts, availability.service.ts,
│   │                              # reservation-lock.service.ts (pg_advisory_xact_lock)
│   ├── period.vo.ts               # value object: invariantes de rango, overlaps(), duration()
│   └── reservations.module.ts
└── health/
    └── health.controller.ts
```

Los ficheros `*.spec.ts` van **junto al fichero que prueban**, no en un árbol `test/`
paralelo. Solo los e2e viven en `test/`.

#### Qué se descartó de una arquitectura hexagonal, y por qué

Una primera versión de este diseño separaba `domain/ · application/ · infrastructure/`
con puertos, tokens de inyección y entidades de dominio distintas de las de TypeORM.
**Se descartó deliberadamente**: para un sistema de este tamaño, esa ceremonia añade
ficheros sin añadir garantías.

| Se quitó                                                                | Por qué                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Carpetas `domain/`, `application/`, `infrastructure/`                   | Tres niveles de anidación para dos módulos. La convención plana se navega mejor.                                                                                                                       |
| Puertos + tokens (`RESERVATION_REPOSITORY`, `RESOURCE_READER`, `CLOCK`) | La clase `ReservationRepository` **ya es** la abstracción: los servicios nunca ven `Repository<T>` de TypeORM. Nest sustituye clases en los tests con `overrideProvider()` igual que sustituye tokens. |
| Entidad de dominio + entidad ORM + mappers `toOrm`/`toDomain`           | Duplica el modelo y obliga a mantener dos ficheros sincronizados. Una sola entidad de TypeORM.                                                                                                         |
| Abstracción `UnitOfWork`                                                | `dataSource.transaction()` de TypeORM ya es esa abstracción, y es la que el equipo reconoce.                                                                                                           |
| Fachada tipo `orchestrator`                                             | En un CRM grande da un punto de entrada único a los controllers; aquí solo añade un salto.                                                                                                             |

Resultado: **de ~38 ficheros a ~20** en el módulo de reservas, sin perder ninguna de las
propiedades que importan &mdash;la invariante sigue en la base de datos, las reglas siguen
siendo abiertas a extensión y los tests siguen corriendo sin base de datos&mdash;.

**Lo que sí se conserva**, porque cada uno se paga solo:

- **`period.vo.ts`** &mdash; ~40 líneas donde vive la semántica `[start, end)`. Función pura,
  se prueba sin base de datos y es el sitio único donde puede estar el bug de la frontera.
- **`rules/`** &mdash; siete clases pequeñas reunidas por un proveedor de factoría. Es la
  demostración concreta del principio abierto/cerrado y no cuesta ninguna capa extra.
- **`repositories/`** &mdash; la convención del CRM. Mantiene `QueryBuilder` fuera de los
  servicios, que es lo que la separación dominio/infraestructura buscaba de verdad.

### 3.2 Modelo de datos

| Tabla                                        | Campos relevantes                                                                                                                        | Papel                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `resource_type`                              | `id`, `code` (único), `name`, `attributes_schema jsonb`, `is_active`                                                                     | Familia reservable. El JSON Schema declara qué atributos exige el tipo. |
| `resource`                                   | `id`, `resource_type_id`, `code` (único), `name`, `capacity`, `location`, `time_zone`, `attributes jsonb`, `is_active`, `deactivated_at` | La unidad reservable. Baja lógica.                                      |
| `resource_availability`                      | `resource_id`, `day_of_week` (0–6), `start_time time`, `end_time time`                                                                   | Ventana operativa semanal. Sin filas = 24/7.                            |
| `resource_block`                             | `resource_id`, `start_at`, `end_at`, `period` (generada), `reason`                                                                       | Mantenimiento, festivo, avería.                                         |
| `reservation`                                | ver §3.3                                                                                                                                 | El núcleo. Aquí vive la constraint de exclusión.                        |
| `user_profile`                               | `user_id` (PK, FK → `user`), `active_reservation_limit`, `department`                                                                    | Extiende Better Auth sin tocar sus tablas.                              |
| `user`, `session`, `account`, `verification` | gestionadas por Better Auth                                                                                                              | Identidad y sesiones.                                                   |

**Estados:** `CONFIRMED` (inicial, sin flujo de aprobación), `CANCELLED` (terminal, libera
el hueco), `COMPLETED` (asignado cuando `end_at < now()`). **Solo `CONFIRMED` entra en la
constraint**: una reserva cancelada no bloquea nada, y eso es exactamente lo que expresa la
cláusula `WHERE` del índice parcial.

### 3.3 Esquema SQL

Cuatro migraciones escritas a mano en SQL: TypeORM no sabe modelar columnas generadas ni
constraints de exclusión, y este DDL es demasiado importante para dejarlo a un generador.

```sql
-- database/migrations/1756700000003-CreateReservations.ts

-- Necesaria para combinar igualdad (uuid) y solape (rango) en un mismo índice GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE reservation_status AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

CREATE TABLE reservation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id         uuid NOT NULL REFERENCES resource(id) ON DELETE RESTRICT,
  user_id             text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  title               varchar(160) NOT NULL,
  start_at            timestamptz NOT NULL,
  end_at              timestamptz NOT NULL,

  -- Columna generada: el rango nunca puede desincronizarse de start_at/end_at.
  -- '[)' = semiabierto: 10:00-11:00 y 11:00-12:00 NO se solapan.
  period              tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED,

  status              reservation_status NOT NULL DEFAULT 'CONFIRMED',
  attendees           int,
  notes               text,
  cancelled_at        timestamptz,
  cancelled_by        text REFERENCES "user"(id),
  cancellation_reason varchar(300),
  idempotency_key     varchar(80),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reservation_valid_range CHECK (end_at > start_at),
  CONSTRAINT reservation_cancellation_consistent CHECK (
    (status = 'CANCELLED') = (cancelled_at IS NOT NULL)
  ),

  -- LA regla del enunciado, como invariante física de la base de datos.
  CONSTRAINT reservation_no_overlap EXCLUDE USING gist (
    resource_id WITH =,
    period      WITH &&
  ) WHERE (status = 'CONFIRMED')
);

-- Reintentos de red no crean reservas duplicadas.
CREATE UNIQUE INDEX reservation_idempotency_uq
  ON reservation (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Consultas de disponibilidad: recorrido por recurso + rango.
CREATE INDEX reservation_resource_period_idx ON reservation USING gist (resource_id, period)
  WHERE status = 'CONFIRMED';

-- Listados filtrados y paginados.
CREATE INDEX reservation_user_start_idx   ON reservation (user_id, start_at DESC);
CREATE INDEX reservation_status_start_idx ON reservation (status, start_at DESC);
```

En TypeORM, `period` se declara de solo lectura para que el ORM no intente escribirla:

```ts
// reservations/entities/reservation.entity.ts
@Column({ type: 'tstzrange', insert: false, update: false, select: false })
readonly period!: string;
```

### 3.4 La regla del no solapamiento

Referencia: una reserva `CONFIRMED` de **10:00 a 11:00**.

| Caso               | Candidata     | ¿Conflicto? | Por qué                                       |
| ------------------ | ------------- | ----------- | --------------------------------------------- |
| a · justo antes    | 09:00 – 10:00 | ❌ **no**   | Frontera: `end == start`. Con `[)` no solapa. |
| b · justo después  | 11:00 – 12:00 | ❌ **no**   | Frontera: `start == end`. Con `[)` no solapa. |
| c · pisa el inicio | 09:30 – 10:30 | ✅ sí       | Solape parcial.                               |
| d · pisa el final  | 10:30 – 11:30 | ✅ sí       | Solape parcial.                               |
| e · contenida      | 10:15 – 10:45 | ✅ sí       | Dentro de la existente.                       |
| f · envolvente     | 09:30 – 11:30 | ✅ sí       | Contiene a la existente.                      |
| g · idéntica       | 10:00 – 11:00 | ✅ sí       | Coincidencia exacta.                          |

Los casos **a** y **b** son los que separan una implementación cuidadosa de una ingenua.
Esta tabla se convierte literalmente en un test parametrizado (§6.1).

#### Tres capas de defensa

| #   | Capa                                    | Rol                                                                                          | Respuesta       |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------- | --------------- |
| 1   | `Period` value object                   | Rechaza `end ≤ start`, duración fuera de rango, granularidad inválida. Función pura, sin BD. | 422             |
| 2   | Advisory lock + consulta en transacción | Produce un **error útil**: qué reserva choca y a qué hora.                                   | 409 con detalle |
| 3   | Constraint `EXCLUDE` de PostgreSQL      | La última palabra. Si algo esquiva las capas anteriores, la BD rechaza el `INSERT`.          | 409 genérico    |

> **Por qué las tres.** La constraint sola bastaría para _garantizar_ la invariante, pero
> devolvería un error opaco. La capa 2 existe para la calidad del mensaje, no para la
> corrección. Y la capa 2 sola sería incorrecta con más de una instancia de la API. Se
> necesitan las dos por razones distintas: **corrección abajo, ergonomía arriba**.

```ts
// reservations/services/reservation.service.ts
@Injectable()
export class ReservationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly reservationRepository: ReservationRepository,
    private readonly resourceRepository: ResourceRepository,
    private readonly lockService: ReservationLockService,
    private readonly clock: ClockService,
    // Las reglas llegan como array desde una factoria (ver reservations.module.ts).
    @Inject(RESERVATION_RULES) private readonly rules: ReservationRule[],
  ) {}

  async create(dto: CreateReservationDto, userId: string): Promise<ReservationDto> {
    // Capa 1 — el VO valida forma antes de abrir transacción.
    const period = Period.create(dto.startAt, dto.endAt);

    const reservation = await this.dataSource.transaction(async (manager) => {
      // Capa 2 — serializa las creaciones sobre ESTE recurso.
      // Se libera al cerrar la transacción; recursos distintos no compiten.
      await this.lockService.acquire(dto.resourceId, manager);

      const resource = await this.resourceRepository.findActiveById(dto.resourceId, manager);
      if (!resource) throw new NotFoundException(`Recurso ${dto.resourceId} no encontrado`);

      const context: ReservationContext = {
        resource,
        period,
        userId,
        attendees: dto.attendees,
        now: this.clock.now(),
      };

      // Todas las reglas, en orden. La primera que falla lanza su excepción.
      for (const rule of this.rules) {
        await rule.check(context, manager);
      }

      // Capa 3 — si la constraint salta aquí, el repositorio traduce 23P01.
      return this.reservationRepository.create(
        { ...context, title: dto.title, notes: dto.notes },
        manager,
      );
    });

    return this.mapToDto(reservation);
  }
}
```

`ClockService` es una clase normal, sin token: hace el tiempo inyectable para que
`NotInThePastRule` se pruebe con un reloj fijo, y en los tests se sustituye con
`overrideProvider(ClockService)`. La misma testabilidad que daba el token `CLOCK`, sin
la ceremonia.

```ts
// reservations/services/reservation-lock.service.ts
@Injectable()
export class ReservationLockService {
  async acquire(resourceId: string, manager: EntityManager): Promise<void> {
    // hashtextextended da un bigint estable a partir del uuid.
    // El sufijo _xact_ lo libera automáticamente al cerrar la transacción.
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [resourceId]);
  }
}

// reservations/repositories/reservation.repository.ts
async create(data: NewReservation, manager: EntityManager): Promise<Reservation> {
  try {
    const reservation = manager.create(Reservation, toEntity(data));
    return await manager.save(reservation);
  } catch (error) {
    // 23P01 = exclusion_violation. Es la capa 3 hablando.
    if (isPgError(error, '23P01') && error.constraint === 'reservation_no_overlap') {
      throw new OverlappingReservationException(data.resource.id, data.period);
    }
    if (isPgError(error, '23505') && error.constraint === 'reservation_idempotency_uq') {
      throw new DuplicateReservationException(data.idempotencyKey!);
    }
    throw error;
  }
}
```

### 3.5 Motor de reglas — el principio abierto/cerrado, en concreto

Añadir una regla de negocio no debe implicar editar `CreateReservationService`.

```ts
// reservations/rules/reservation-rule.interface.ts
export interface ReservationRule {
  readonly name: string;
  /** Lanza una excepción si el contexto viola la regla. No devuelve nada. */
  check(context: ReservationContext, manager: EntityManager): Promise<void>;
}

export const RESERVATION_RULES = Symbol('RESERVATION_RULES');
```

```ts
// reservations/reservations.module.ts — el único sitio que cambia al añadir una regla
const rules = [
  ResourceIsActiveRule,
  NotInThePastRule,
  AllowedDurationRule,
  WithinOperatingHoursRule,
  NoResourceBlockRule,
  NoOverlapRule, // <- la regla central
  SufficientCapacityRule,
  ActiveReservationLimitRule,
];

@Module({
  imports: [TypeOrmModule.forFeature([Reservation]), ResourcesModule, AuthModule],
  controllers: [ReservationsController, AvailabilityController],
  providers: [
    ReservationService,
    AvailabilityService,
    ReservationLockService,
    ReservationRepository,
    ClockService,
    ...rules,
    // Único token del módulo, y está justificado: inyectar una LISTA de reglas
    // sin que el servicio conozca ninguna de ellas por su nombre.
    // NO `multi: true`: eso es de Angular. Nest no tiene multi-providers y se
    // queda con un solo valor, asi que el servicio inyecta UNA regla en vez de
    // la lista y revienta en la primera reserva. La factoria es el idioma Nest.
    { provide: RESERVATION_RULES, useFactory: (...r) => r, inject: rules },
  ],
  exports: [ReservationService],
})
export class ReservationsModule {}
```

| Regla                        | Qué comprueba                                                       | Código de error             | HTTP |
| ---------------------------- | ------------------------------------------------------------------- | --------------------------- | ---: |
| `ResourceIsActiveRule`       | El recurso existe y no está dado de baja.                           | `RESOURCE_UNAVAILABLE`      |  409 |
| `NotInThePastRule`           | `startAt ≥ now` (1 min de tolerancia de reloj).                     | `RESERVATION_IN_PAST`       |  422 |
| `AllowedDurationRule`        | Entre 15 min y 8 h, en múltiplos de 15 min.                         | `INVALID_DURATION`          |  422 |
| `WithinOperatingHoursRule`   | Cae dentro del horario semanal, en la TZ del recurso.               | `OUTSIDE_OPERATING_HOURS`   |  409 |
| `NoResourceBlockRule`        | No se cruza con mantenimiento ni festivo.                           | `RESOURCE_BLOCKED`          |  409 |
| **`NoOverlapRule`**          | Ninguna reserva `CONFIRMED` cruza el periodo. **La regla central.** | `OVERLAPPING_RESERVATION`   |  409 |
| `SufficientCapacityRule`     | `attendees ≤ resource.capacity`.                                    | `CAPACITY_EXCEEDED`         |  422 |
| `ActiveReservationLimitRule` | El usuario no supera su tope de reservas futuras.                   | `RESERVATION_LIMIT_REACHED` |  409 |

```ts
// reservations/rules/no-overlap.rule.ts
@Injectable()
export class NoOverlapRule implements ReservationRule {
  readonly name = 'NO_OVERLAP';

  constructor(private readonly reservationRepository: ReservationRepository) {}

  async check(context: ReservationContext, manager: EntityManager): Promise<void> {
    const conflict = await this.reservationRepository.findOverlapping(
      context.resource.id, context.period, context.excludedReservationId, manager,
    );
    if (conflict) {
      // La excepción lleva datos: el front puede decir "ocupado de 10:00 a 11:00".
      throw new OverlappingReservationException(context.resource.id, context.period, conflict);
    }
  }
}

// reservations/repositories/reservation.repository.ts
// El solape se delega en el operador de rangos, no en comparaciones a mano.
async findOverlapping(resourceId, period, excludeId, manager) {
  const qb = manager.createQueryBuilder(Reservation, 'r')
    .where('r.resource_id = :resourceId', { resourceId })
    .andWhere("r.status = 'CONFIRMED'")
    .andWhere("r.period && tstzrange(:startAt, :endAt, '[)')", period.toRange());

  // andWhere, nunca where: en TypeORM, .where() DESCARTA las condiciones anteriores.
  if (excludeId) qb.andWhere('r.id != :excludeId', { excludeId });

  return qb.getOne();  // usa el índice GiST parcial: recorrido por rango, no scan
}
```

> **Nota de diseño.** El operador `&&` cubre los siete casos sin una sola comparación
> manual de fechas. Escribir `start < :end AND end > :start` daría el mismo resultado, pero
> el rango es explícito sobre la semántica semiabierta y usa **el mismo índice que la
> constraint**. Que la comprobación y la garantía hablen el mismo lenguaje elimina la
> posibilidad de que discrepen.

### 3.6 Consulta de disponibilidad

Dado un recurso y un rango, devolver los huecos libres:

1. Generar las ventanas operativas de cada día desde `resource_availability`, convirtiendo
   a UTC según `resource.time_zone`.
2. Restar los `resource_block` del rango.
3. Restar las reservas `CONFIRMED` del rango (una sola consulta, servida por el índice GiST).
4. Descartar los huecos más cortos que `minDurationMinutes`.

La resta vive en una función pura, `subtractIntervals(base, busy): Interval[]`, con su
propia batería de tests sin base de datos. **Se eligió TypeScript sobre `range_agg` y
multirangos de PostgreSQL deliberadamente**: el SQL sería más corto y más difícil de probar
exhaustivamente, y esta es una función que tiene que ser correcta en los bordes.

### 3.7 Contrato de la API

Prefijo `/api/v1`. Documentado con `@nestjs/swagger` en `/api/docs`; el JSON de OpenAPI es
además la fuente de los tipos del frontend (§4.2).

| Método y ruta                         | Acceso  | Qué hace                                                                 | Respuestas                 |
| ------------------------------------- | ------- | ------------------------------------------------------------------------ | -------------------------- |
| **Catálogo**                          |         |                                                                          |                            |
| `GET /resource-types`                 | sesión  | Lista los tipos con su esquema de atributos.                             | 200                        |
| `POST /resource-types`                | admin   | Crea un tipo. Valida que `attributes_schema` sea JSON Schema válido.     | 201 · 409                  |
| `POST /resources`                     | admin   | Crea un recurso; `attributes` se valida contra el esquema del tipo.      | 201 · 422 · 409            |
| `GET /resources`                      | sesión  | Paginado. Filtros: `typeId`, `q`, `minCapacity`, `isActive`, `location`. | 200                        |
| `GET /resources/:id`                  | sesión  | Detalle con disponibilidad y bloqueos vigentes.                          | 200 · 404                  |
| `PATCH /resources/:id`                | admin   | Actualización parcial.                                                   | 200 · 404 · 422            |
| `DELETE /resources/:id`               | admin   | **Baja lógica.** Rechaza si hay reservas futuras, salvo `?force=true`.   | 204 · 409                  |
| `PUT /resources/:id/availability`     | admin   | Reemplaza la ventana semanal completa.                                   | 200 · 422                  |
| `POST /resources/:id/blocks`          | admin   | Registra mantenimiento o cierre.                                         | 201 · 409                  |
| **Disponibilidad y reservas**         |         |                                                                          |                            |
| `GET /resources/:id/availability`     | sesión  | Huecos libres. `from`, `to` (máx. 60 días), `minDurationMinutes`.        | 200 · 422                  |
| `POST /reservations`                  | sesión  | **Crea una reserva.** Acepta cabecera `Idempotency-Key`.                 | 201 · **409 solape** · 422 |
| `GET /reservations`                   | sesión  | Listado con filtros y paginación. Sin rol admin, solo las propias.       | 200                        |
| `GET /reservations/:id`               | sesión  | Detalle con recurso y usuario embebidos.                                 | 200 · 403 · 404            |
| `PATCH /reservations/:id`             | dueño   | Reprograma. Reejecuta _todas_ las reglas excluyéndose a sí misma.        | 200 · 409 · 422            |
| `POST /reservations/:id/cancellation` | dueño   | **Cancela** con motivo. Idempotente.                                     | 200 · 403 · 409            |
| **Sistema**                           |         |                                                                          |                            |
| `ALL /api/auth/*`                     | público | Gestionado por Better Auth.                                              | —                          |
| `GET /health`                         | público | Liveness y readiness con `@nestjs/terminus`.                             | 200 · 503                  |
| `GET /api/docs`                       | público | Swagger UI.                                                              | 200                        |

**Cancelar es `POST /reservations/:id/cancellation`, no `DELETE`.** Cancelar no borra: es
una transición de estado que registra quién, cuándo y por qué. Modelarla como creación de
un hecho de cancelación lo deja explícito en la URL y permite llevar cuerpo con el motivo.

```
GET /api/v1/reservations
  ?resourceId=uuid
  &userId=text                # solo admin puede consultar otros
  &resourceTypeId=uuid
  &status=CONFIRMED           # repetible: &status=CANCELLED
  &from=2026-09-01T00:00:00Z
  &to=2026-09-30T23:59:59Z    # solapan con el rango, no "contenidas en"
  &page=1&limit=20            # limit máx. 100
  &sort=startAt:asc           # campos permitidos: startAt, createdAt
```

### 3.8 Errores y paginación

Todos los errores salen en **Problem Details (RFC 7807)** desde un único
`ProblemDetailsFilter` global. Los servicios lanzan errores de dominio que no saben nada de
HTTP; el filtro los traduce.

```jsonc
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "https://api.reservations.local/errors/overlapping-reservation",
  "title": "El recurso ya está reservado en ese horario",
  "status": 409,
  "detail": "Sala Aurora está ocupada de 10:00 a 11:00 del 15/09/2026.",
  "instance": "/api/v1/reservations",
  "code": "OVERLAPPING_RESERVATION",
  "requestId": "01J8X2K9...",
  "conflict": {
    "reservationId": "9f1c...",
    "startAt": "2026-09-15T10:00:00Z",
    "endAt":   "2026-09-15T11:00:00Z"
  }
}
```

> El campo `title` y `detail` van **en español** porque el front los muestra tal cual al
> usuario. Es la única excepción a la regla de idioma en el backend, y es deliberada:
> centralizar el texto de cara al usuario en el catálogo de errores del servidor evita
> duplicar traducciones en el cliente.

```jsonc
// Sobre de paginación — idéntico en los tres listados
{
  "data": [/* ... */],
  "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 },
}
```

Paginación por `page`/`limit` y no por cursor: los volúmenes de esta prueba no lo
justifican y el offset permite mostrar "página 4 de 7", que es lo que espera un DataGrid.
Merece una frase en el reflexivo reconociendo que a escala real el cursor sería correcto.

### 3.9 Documentación de la API con Swagger

Swagger no es solo documentación aquí: **el JSON de OpenAPI es la fuente de los tipos del
frontend** (§4.2). Si se degrada, el cliente deja de compilar. Eso lo convierte en un
artefacto de build, no en un extra.

#### Configuración

```ts
// src/config/swagger.config.ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Shared Resource Booking API')
    .setDescription(
      'API de reservas de recursos compartidos.\n\n' +
        '**Regla central:** dos reservas CONFIRMED nunca se solapan en el mismo recurso. ' +
        'Los intervalos son semiabiertos `[start, end)`, así que 10:00–11:00 y 11:00–12:00 ' +
        'son contiguas y ambas válidas.\n\n' +
        'Los errores siguen RFC 7807 (`application/problem+json`).',
    )
    // Se lee del package.json: la versión del documento y la del artefacto
    // publicado no pueden divergir (ver 5.4).
    .setVersion(process.env.npm_package_version ?? '0.0.0')
    .addServer('http://localhost:3000', 'Local')

    // Better Auth autentica por cookie de sesión, no por bearer. Sin esto, el
    // botón "Authorize" de Swagger UI no sirve para nada.
    .addCookieAuth('better-auth.session_token', {
      type: 'apiKey',
      in: 'cookie',
      description: 'Cookie de sesión emitida por POST /api/auth/sign-in/email',
    })

    .addTag('Resource types', 'Familias de recursos y su esquema de atributos')
    .addTag('Resources', 'Alta, consulta y baja de recursos reservables')
    .addTag('Availability', 'Huecos libres de un recurso en un rango')
    .addTag('Reservations', 'Crear, listar, reprogramar y cancelar reservas')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json', // lo consume openapi-typescript
    swaggerOptions: {
      persistAuthorization: true, // la sesión sobrevive al recargar la UI
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
```

#### El plugin del CLI: el detalle que evita 300 decoradores

```jsonc
// nest-cli.json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    // Infiere tipos, obligatoriedad y descripciones de los DTO leyendo el AST.
    // Sin esto haría falta un @ApiProperty() por cada campo de cada DTO.
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "introspectComments": true, // el comentario /** */ pasa a description
          "dtoFileNameSuffix": [".dto.ts"],
          "classValidatorShim": true, // @IsInt() -> type: integer, etc.
        },
      },
    ],
  },
}
```

Con `introspectComments` y `classValidatorShim`, un DTO se documenta solo:

```ts
// reservations/dtos/create-reservation.dto.ts
export class CreateReservationDto {
  /** Recurso a reservar. */
  @IsUUID()
  resourceId!: string;

  /** Título visible en la agenda. */
  @IsString()
  @MaxLength(160)
  title!: string;

  /** Inicio en UTC, ISO 8601. Inclusivo. */
  @IsISO8601()
  startAt!: string;

  /** Fin en UTC, ISO 8601. **Exclusivo**: una reserva que termina a las 11:00 no
   *  colisiona con una que empieza a las 11:00. */
  @IsISO8601()
  endAt!: string;

  /** Asistentes previstos. Se valida contra la capacidad del recurso. */
  @IsOptional()
  @IsInt()
  @Min(1)
  attendees?: number;
}
```

#### Documentar los errores, que es lo que nadie documenta

Un 201 lo adivina cualquiera. Lo que hace útil esta API es el 409, así que va con ejemplo:

```ts
// reservations/controllers/reservations.controller.ts
@Post()
@ApiOperation({
  summary: 'Crea una reserva',
  description:
    'Aplica todas las reglas de negocio y garantiza la no superposición. ' +
    'Acepta la cabecera `Idempotency-Key` para que un reintento de red no cree dos reservas.',
})
@ApiHeader({ name: 'Idempotency-Key', required: false })
@ApiCreatedResponse({ type: ReservationDto })
@ApiConflictResponse({
  description: 'El recurso ya está ocupado, o alguna regla de negocio lo impide.',
  schema: { $ref: getSchemaPath(ProblemDetailsDto) },
  examples: {
    overlap: {
      summary: 'Solape con una reserva existente',
      value: {
        type: 'https://api.reservations.local/errors/overlapping-reservation',
        title: 'El recurso ya está reservado en ese horario',
        status: 409,
        code: 'OVERLAPPING_RESERVATION',
        conflict: {
          reservationId: '9f1c…',
          startAt: '2026-09-15T10:00:00Z',
          endAt: '2026-09-15T11:00:00Z',
        },
      },
    },
  },
})
@ApiUnprocessableEntityResponse({ type: ProblemDetailsDto })
create(@Body() dto: CreateReservationDto, @CurrentUser() user: AuthenticatedUser) { … }
```

Y un decorador propio para no repetir el sobre de paginación en tres controladores:

```ts
// common/decorators/api-paginated-response.decorator.ts
export const ApiPaginatedResponse = <T extends Type<unknown>>(model: T) =>
  applyDecorators(
    ApiExtraModels(PaginatedResponseDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          { properties: { data: { type: 'array', items: { $ref: getSchemaPath(model) } } } },
        ],
      },
    }),
  );

// Uso:  @ApiPaginatedResponse(ReservationDto)
```

#### Generar el spec sin levantar el servidor

El frontend necesita el JSON en CI, donde no hay una API corriendo. Un script lo emite:

```ts
// scripts/generate-openapi.ts
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { AppModule } from '../src/app.module';

async function main() {
  // create(), no listen(): construye el grafo de módulos y sale.
  const app = await NestFactory.create(AppModule, { logger: false });
  writeFileSync('openapi.json', JSON.stringify(buildDocument(app), null, 2));
  await app.close();
}
main();
```

```jsonc
// package.json
"openapi:generate": "tsx scripts/generate-openapi.ts",
// En el front:  "api:types": "openapi-typescript ../api/openapi.json -o src/lib/api/schema.d.ts"
```

> **Un job del CI compara el `openapi.json` versionado con el recién generado.** Si
> difieren, el PR falla con «regenera el spec». Así el contrato no se desincroniza en
> silencio del código, que es la forma habitual en que la documentación generada se
> convierte en mentira.

---

### 3.10 Autenticación: un adaptador, no un acoplamiento

Better Auth es una buena elección, pero introduce dos riesgos distintos que conviene no
confundir:

| Riesgo                                                                      | Gravedad | Origen                                                  |
| --------------------------------------------------------------------------- | -------- | ------------------------------------------------------- |
| **A.** `@thallesp/nestjs-better-auth` es un paquete comunitario, no oficial | Media    | Una dependencia de terceros en la ruta de autenticación |
| **B.** Los tipos y decoradores del proveedor se filtran a todo el código    | **Alta** | Diseño propio, no del proveedor                         |

El riesgo B es el caro. Si `typeof auth.$Infer.Session` aparece en quince controladores y
el `@Session()` del paquete comunitario en treinta endpoints, cambiar de proveedor
significa tocar cuarenta y cinco ficheros. **Y ese riesgo es enteramente nuestro**: nada
en Better Auth obliga a ello.

#### El patrón: Adapter sobre un puerto estrecho

El patrón de diseño correcto es **Adapter**, apoyado en una **capa anticorrupción**
(_Anti-Corruption Layer_, del DDD) y con **Strategy** para elegir implementación en el
arranque. Traducido a algo concreto: **una interfaz de dos métodos, y un contrato de
tipo propio que ningún tipo del proveedor cruza.**

```ts
// auth/ports/auth-provider.port.ts   <- todo el acoplamiento vive aquí

/** Nuestro contrato de identidad. No espeja la forma de ningún proveedor. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

export interface AuthProvider {
  readonly name: string;

  /** Resuelve la identidad desde las cabeceras crudas. `null` = anónimo. */
  authenticate(headers: Headers): Promise<AuthenticatedUser | null>;

  /**
   * Manejador HTTP propio del proveedor (login, registro, callbacks), montado
   * bajo /api/auth/*. `null` si el proveedor no expone rutas propias.
   */
  getRequestHandler(): RequestHandler | null;
}

export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
```

**Dos métodos. Eso es toda la superficie de acoplamiento del sistema con su proveedor de
identidad.** Este es el único sitio del backend, junto a `RESERVATION_RULES`, donde se
justifica un token de inyección: aquí sí se está eligiendo entre implementaciones
intercambiables en tiempo de arranque (§3.11).

La configuración del proveedor queda encapsulada junto a su adaptador, y **no se exporta
fuera del módulo**:

```ts
// auth/providers/better-auth.config.ts
import { betterAuth } from 'better-auth';
import { admin, openAPI } from 'better-auth/plugins';
import { Pool } from 'pg';

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  // El front vive en otro origen: hay que declararlo explícitamente.
  trustedOrigins: [process.env.FRONTEND_URL!],
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  plugins: [admin({ defaultRole: 'user', adminRoles: ['admin'] }), openAPI()],
});
```

```ts
// auth/providers/better-auth.provider.ts   <- el ADAPTADOR
@Injectable()
export class BetterAuthProvider implements AuthProvider {
  readonly name = 'better-auth';

  async authenticate(headers: Headers): Promise<AuthenticatedUser | null> {
    const session = await auth.api.getSession({ headers });
    if (!session) return null;

    // La traducción es la capa anticorrupción: la forma de Better Auth
    // (session.user.role como string) muere en esta línea.
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      roles: session.user.role ? [session.user.role] : ['user'],
    };
  }

  getRequestHandler(): RequestHandler {
    return toNodeHandler(auth); // de 'better-auth/node', no del paquete comunitario
  }
}
```

```ts
// auth/auth.controller.ts   <- las ~15 líneas que sustituyen al paquete comunitario
@Controller('api/auth')
@Public()
export class AuthController {
  constructor(@Inject(AUTH_PROVIDER) private readonly provider: AuthProvider) {}

  @All('*splat')
  handle(@Req() req: Request, @Res() res: Response) {
    const handler = this.provider.getRequestHandler();
    if (!handler) throw new NotFoundException();
    return handler(req, res);
  }
}
```

```ts
// auth/guards/authentication.guard.ts   <- el ÚNICO consumidor del puerto
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const user = await this.provider.authenticate(toWebHeaders(request.headers));

    if (isPublic) {
      request.user = user ?? undefined; // opcional: si hay sesión, se usa
      return true;
    }
    if (!user) throw new UnauthorizedException('Sesión no válida o expirada');

    request.user = user;
    return true;
  }
}
```

#### Decoradores propios: la mitad del valor está aquí

```ts
// auth/decorators/
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => ctx.switchToHttp().getRequest().user,
);

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

Los controladores usan **solo** `@CurrentUser()`, `@Public()` y `@Roles('admin')`, todos
de `auth/decorators/`. Nunca importan nada de `better-auth` ni del paquete comunitario.
Es una regla de una línea en ESLint, así que no depende de que nadie se acuerde:

```js
// eslint.config.mjs
{
  files: ['src/**/*.ts'],
  ignores: ['src/auth/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['better-auth', 'better-auth/*', '@thallesp/*'],
        message: 'La identidad se consume por AuthProvider y los decoradores de auth/. Ver 3.10.',
      }],
    }],
  },
}
```

#### Strategy: elegir el proveedor en el arranque

```ts
// auth/auth.module.ts
@Module({})
export class AuthModule {
  static forRoot(): DynamicModule {
    // Una variable de entorno, no un despliegue nuevo. Y en los tests e2e,
    // FakeAuthProvider evita levantar un flujo de login real en cada caso.
    const providers: Record<string, Type<AuthProvider>> = {
      'better-auth': BetterAuthProvider,
      jwt: JwtAuthProvider,
      fake: FakeAuthProvider,
    };
    const useClass = providers[process.env.AUTH_PROVIDER ?? 'better-auth'];

    return {
      module: AuthModule,
      controllers: [AuthController],
      providers: [{ provide: AUTH_PROVIDER, useClass }, AuthenticationGuard, RolesGuard],
      // Se exportan el token y los guards. NUNCA el objeto `auth`.
      exports: [AUTH_PROVIDER, AuthenticationGuard, RolesGuard],
    };
  }
}
```

#### Lo que hace que el reemplazo sea real y no una esperanza

Una abstracción sin test de contrato es una intención. **La misma batería corre contra
todas las implementaciones**, y es lo que convierte «se podría cambiar» en «se puede
cambiar, y lo demuestro»:

```ts
// auth/ports/auth-provider.contract.spec.ts
export function testAuthProviderContract(
  name: string,
  build: () => Promise<AuthProvider>,
) {
  describe(`AuthProvider contract: ${name}`, () => {
    it('returns null for a request with no credentials', async () => { … });
    it('returns null for a malformed or expired credential', async () => { … });
    it('returns id, email, name and at least one role for a valid session', async () => { … });
    it('never leaks provider-specific fields into AuthenticatedUser', async () => {
      const user = await (await build()).authenticate(validHeaders);
      expect(Object.keys(user!).sort()).toEqual(['email', 'id', 'name', 'roles']);
    });
  });
}

testAuthProviderContract('better-auth', () => buildBetterAuthProvider());
testAuthProviderContract('jwt',         () => buildJwtProvider());
```

#### El coste real de sustituir Better Auth

| Qué cambia                                                      | Ficheros    |
| --------------------------------------------------------------- | ----------- |
| Nueva implementación de `AuthProvider`                          | 1 nuevo     |
| Registrarla en el mapa de `AuthModule.forRoot()`                | 1 línea     |
| Migración de datos del esquema de identidad                     | 1 migración |
| **Controladores, servicios, reglas, guards, decoradores, DTOs** | **0**       |

Los tests de contrato ya existentes validan la implementación nueva antes de activarla.

> **Cambio de recomendación respecto al borrador anterior.** Antes proponía usar
> `@thallesp/nestjs-better-auth` con este diseño como plan B. **Ahora propongo no usarlo
> desde el principio.** El `AuthController` y el `AuthenticationGuard` de arriba son ~40
> líneas que ya hay que escribir para tener el adaptador; el paquete comunitario no
> ahorra nada sobre eso y a cambio mete una dependencia no oficial en la ruta de
> autenticación. **Eliminar una dependencia y ganar el punto de sustitución es una mejora
> en las dos direcciones**, y es exactamente el tipo de decisión que el documento
> reflexivo debe contar.

**Migraciones: una sola historia.** Better Auth trae su propio CLI, pero tener dos sistemas
de migración sobre la misma base es fuente de sorpresas. Se ejecuta
`npx @better-auth/cli generate` **una vez**, se copia el DDL a la primera migración de
TypeORM y desde ahí todo se gestiona con `typeorm migration:run`. Un solo comando levanta
el esquema, y las FK de `reservation` hacia `user` quedan garantizadas por orden.

```ts
// src/main.ts — los dos detalles que hay que acertar
// Better Auth necesita el cuerpo crudo de la petición.
const app = await NestFactory.create(AppModule, { bodyParser: false });

app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true });
app.setGlobalPrefix('api/v1', { exclude: ['api/auth/(.*)', 'health'] });
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true, // mitiga class-transformer sin mantenimiento (§1.1)
    transform: true,
  }),
);
app.useGlobalFilters(new ProblemDetailsFilter());
setupSwagger(app); // §3.9
```

### 3.11 SOLID, fichero a fichero

Aplicado con la estructura modular, sin capas extra. El punto de esta tabla es que cada
principio se cumple por una decisión **concreta y localizable**, no por la forma del árbol
de carpetas.

| Principio                         | Dónde vive                                                                                                                                                                                                                                  | Qué se gana                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **S** · Responsabilidad única     | Servicios separados por responsabilidad, como en el CRM: `ReservationService` (escrituras), `AvailabilityService` (cálculo de huecos), `ReservationLockService` (concurrencia). `Period` solo sabe de rangos; el repositorio solo persiste. | Ningún fichero pasa de ~150 líneas. Cuando algo falla, el sitio donde mirar es obvio.                                                    |
| **O** · Abierto/cerrado           | `ReservationRule` + proveedor de factoría. Y `resource_type.attributes_schema`, que permite un tipo de recurso nuevo sin desplegar código.                                                                                                  | "Máximo 2 reservas por día" = una clase nueva y una línea en el array. `ReservationService` no se toca.                                  |
| **L** · Sustitución de Liskov     | `ReservationRepository` es una clase concreta que en los tests unitarios se sustituye con `overrideProvider(ReservationRepository).useClass(InMemoryReservationRepository)`. Ambas pasan el mismo contract test.                            | Los tests de reglas corren en milisegundos sin base de datos, y la fake no puede desviarse del contrato sin que salte una prueba.        |
| **I** · Segregación de interfaces | `ReservationRule` expone **un solo método**, `check()`. Los servicios de `reservations` consumen `ResourceRepository` con métodos de lectura, no el `ResourceService` completo.                                                             | Una regla no puede hacer nada más que validar. La superficie mínima es la que se puede probar exhaustivamente.                           |
| **D** · Inversión de dependencias | Los servicios dependen de `ReservationRepository`, **nunca de `Repository<Reservation>` de TypeORM**: el `QueryBuilder` no sale de la carpeta `repositories/`. `ClockService` hace el tiempo inyectable.                                    | Cambiar de ORM toca una carpeta. "No reservar en el pasado" se prueba de forma determinista con un reloj fijo, sin `jest.useFakeTimers`. |

> **Sobre DIP sin tokens.** La versión anterior de este diseño usaba tokens de inyección
> (`@Inject(RESERVATION_REPOSITORY)`) contra interfaces. Se descartó porque en NestJS
> **una clase ya es un contrato sustituible**: `overrideProvider()` intercambia clases
> igual que tokens.
>
> Quedan exactamente **dos** tokens en todo el backend, y cada uno hace algo que una clase
> no puede hacer:
>
> - `RESERVATION_RULES` — inyecta una **lista** de implementaciones (§3.5).
> - `AUTH_PROVIDER` — **elige** entre implementaciones intercambiables en el arranque, por
>   variable de entorno, incluida una falsa para los tests e2e (§3.10).
>
> Que sean dos y no diez es el punto: una abstracción cuesta, y solo se paga donde hay una
> segunda implementación real o previsible.

Dos principios más que sostienen el resto: **hacer imposibles los estados inválidos**
(`Period` no se construye con `end ≤ start`; una reserva con solape no se puede _guardar_)
y **separar comandos de consultas** (los listados usan `QueryBuilder`; las escrituras pasan
por el dominio).

---

## 4. Frontend

El front no forma parte de lo que pide el enunciado: su trabajo es **hacer visible el
backend**. Sin gestor de estado global, sin abstracciones especulativas.

> **Idioma:** identificadores, ficheros y comentarios en inglés; **todo texto visible en
> español**. Los literales de UI no se escriben inline: viven en `src/i18n/es.ts`, lo que
> los hace revisables de un vistazo y deja la puerta abierta a i18n real.

### 4.1 Estructura

```
src/
├── app/                                # App Router · Server Components por defecto
│   ├── layout.tsx                      # AppRouterCacheProvider > ThemeProvider > QueryProvider
│   ├── (public)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # shell autenticado; redirige si no hay sesión
│   │   ├── resources/page.tsx
│   │   ├── resources/[id]/page.tsx
│   │   ├── reservations/page.tsx
│   │   └── schedule/page.tsx
│   └── middleware.ts                   # protege /(dashboard) comprobando la cookie
├── i18n/es.ts                          # ÚNICO fichero con texto en español
├── lib/
│   ├── api/
│   │   ├── schema.d.ts                 # GENERADO por openapi-typescript. No se edita.
│   │   ├── client.ts                   # fetch tipado · credentials:'include' · ProblemDetails → ApiError
│   │   └── errors.ts                   # isOverlapConflict(e), extractConflict(e)
│   ├── auth-client.ts                  # createAuthClient de better-auth/react
│   └── dates.ts                        # date-fns + @date-fns/tz. Formateo SIEMPRE aquí.
├── theme/                              # tokens.ts + theme.ts (claro y oscuro)
├── features/
│   ├── resources/{api,hooks,components}
│   └── reservations/
│       ├── api/reservations.api.ts     # únicas llamadas HTTP de la feature
│       ├── hooks/                      # useReservations · useCreateReservation · useAvailability
│       └── components/                 # BookingDialog · ReservationFilters · ReservationsTable
└── components/                         # genéricos: EmptyState · ErrorState · StatusChip
```

### 4.2 Capa de datos

1. **Los tipos se generan, no se escriben.** `npm run api:types` ejecuta
   `openapi-typescript` contra `/api/docs-json`. Si el backend cambia un campo, el front
   deja de compilar. Cero interfaces duplicadas a mano.
2. **Ningún componente llama a `fetch`.** Componente → hook → módulo `api` de la feature →
   `client.ts`. Una sola dirección.
3. **El servidor es dueño del estado del servidor.** TanStack Query gestiona caché y
   revalidación; el estado local se queda en `useState`; los filtros viven en la URL
   (`useSearchParams`), lo que los hace compartibles y sobrevive al recargar.

```ts
// src/lib/api/client.ts — el único punto que habla HTTP
export class ApiError extends Error {
  constructor(
    readonly problem: ProblemDetails,
    readonly status: number,
  ) {
    super(problem.detail ?? problem.title);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include', // la sesión de Better Auth viaja por cookie
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!response.ok) throw new ApiError(await response.json(), response.status);
  return response.status === 204 ? (undefined as T) : response.json();
}
```

Claves de caché: `['reservations','list',filters]`, `['resources','detail',id]`,
`['availability',resourceId,range]`. Tras crear o cancelar se invalidan `['reservations']`
y `['availability', resourceId]`, nunca todo el caché.

### 4.3 Pantallas

| Ruta              | Qué demuestra                                                                        | Componentes MUI                                          |
| ----------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `/login`          | Sesión con Better Auth: registro y acceso.                                           | `Card`, `TextField`, `Button`, `Alert`                   |
| `/resources`      | CRUD completo y filtros. Los atributos variables se renderizan desde el JSON Schema. | `DataGrid`, `Dialog`, `Autocomplete`, `Chip`             |
| `/resources/[id]` | **Disponibilidad**: selector de semana y huecos libres. Reservar desde un hueco.     | `DateCalendar`, `Paper`, `Skeleton`                      |
| `/reservations`   | **Los cuatro filtros y paginación del servidor.** Cancelar con motivo.               | `DataGrid` en modo servidor, `DateRangePicker`, `Select` |
| `/schedule`       | Rejilla semanal de un recurso. Hace el solapamiento _visible_.                       | CSS Grid + `Tooltip`, `ToggleButtonGroup`                |

Cada vista resuelve sus cuatro estados: cargando (`Skeleton`, no un spinner), vacío (con
acción sugerida), error (con reintentar) y con datos.

### 4.4 El flujo estrella: crear una reserva

1. **Elegir el hueco, no escribir la hora.** El diálogo abre con recurso y día ya elegidos
   y pinta los huecos que devuelve `GET /availability`. Pulsar un hueco rellena inicio y
   fin. La mayoría de conflictos desaparece antes de existir.
2. **Validar en el cliente solo la forma.** `react-hook-form` + `zod` replican las reglas
   _de forma_ (fin > inicio, duración, no en el pasado). Las de negocio se quedan en el
   servidor: duplicarlas sería garantizar que se desincronizan.
3. **Convertir el 409 en algo útil.** Si otra persona reservó mientras tanto, el campo
   `conflict` del Problem Details se traduce en un `Alert` con el horario exacto que choca,
   y debajo se recargan los huecos libres **sin cerrar el diálogo**.
4. **Confirmar sin engañar.** El botón entra en `loading` y se manda una `Idempotency-Key`
   generada al abrir el diálogo: un doble clic no crea dos reservas. **Sin actualización
   optimista aquí**: mostrar una reserva que puede rebotar es peor que esperar 200 ms.

### 4.5 Tema, fechas y accesibilidad

- **Tema propio** con `extendTheme` y `CssVarsProvider`: claro y oscuro sin parpadeo en el
  primer render. Paleta semántica para los estados, siempre a través de un único
  `<StatusChip>`.
- **Fechas en un solo sitio.** Todo formateo pasa por `lib/dates.ts`. La API habla UTC; la
  interfaz muestra la zona del recurso e indica cuál es cuando no coincide con la del
  navegador. Esto elimina la clase de bug más común de una app de reservas.
- **Accesibilidad como parte del trabajo:** `DateTimePicker` con etiquetas asociadas,
  errores en `aria-live="polite"`, foco visible (sin `outline: none`), contraste AA en
  ambos temas, diálogos con foco atrapado y devuelto al cerrar.

---

## 5. Entrega: Docker, versionado y CI/CD

Dos repositorios, cada uno autónomo. El backend incluye su PostgreSQL. Se comunican por una
red externa compartida.

```
test-reservas-backend/            test-reservas-front/
├── Dockerfile                    ├── Dockerfile              # producción (standalone)
├── Dockerfile.dev                ├── Dockerfile.dev
├── docker-compose.yml            ├── docker-compose.yml      # desarrollo
├── docker-compose.prod.yml       ├── docker-compose.prod.yml
├── .dockerignore                 ├── .dockerignore
├── .npmrc                        ├── .npmrc
├── .env.example                  ├── .env.example
└── docker/postgres/init/         └── next.config.ts          # output: 'standalone'
    └── 01-extensions.sql
```

### 5.1 Backend — desarrollo

```dockerfile
# Dockerfile.dev
FROM node:24-alpine

WORKDIR /app
RUN apk add --no-cache tini

COPY package.json package-lock.json .npmrc ./
# --ignore-scripts: ningún postinstall se ejecuta. Vector nº1 de los gusanos de npm.
RUN npm ci --ignore-scripts

COPY . .

EXPOSE 3000 9229
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "start:dev"]
```

```yaml
# docker-compose.yml — desarrollo local
name: reservations-dev

services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: reservations
      POSTGRES_PASSWORD: reservations
      POSTGRES_DB: reservations
      POSTGRES_INITDB_ARGS: '--encoding=UTF8 --locale=C.UTF-8'
    ports: ['5432:5432']
    volumes:
      # PostgreSQL 18: el VOLUME es /var/lib/postgresql, NO /var/lib/postgresql/data.
      # PGDATA por defecto es /var/lib/postgresql/18/docker.
      - postgres-data:/var/lib/postgresql
      - ./docker/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U reservations -d reservations']
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  api:
    build: { context: ., dockerfile: Dockerfile.dev }
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      NODE_ENV: development
      PORT: '3000'
      DATABASE_URL: postgres://reservations:reservations@postgres:5432/reservations
      BETTER_AUTH_SECRET: dev-only-secret-not-for-production-32ch
      BETTER_AUTH_URL: http://localhost:3000
      FRONTEND_URL: http://localhost:3001
    ports: ['3000:3000', '9229:9229']
    volumes:
      - ./src:/app/src
      - ./test:/app/test
      - /app/node_modules # los del contenedor no se pisan con los del host
    command: npm run start:dev

  adminer:
    image: adminer:5
    ports: ['8080:8080']
    depends_on: [postgres]

volumes:
  postgres-data:

networks:
  default:
    name: reservations-net
```

```sql
-- docker/postgres/init/01-extensions.sql
-- Se ejecuta solo en la primera inicialización del volumen.
-- Las migraciones también las crean; esto garantiza que estén desde el minuto cero.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
```

### 5.2 Backend — producción

```dockerfile
# Dockerfile — multi-stage, no root, sin scripts de instalación
# syntax=docker/dockerfile:1.9
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini

# --- deps: solo el árbol de dependencias, cacheable ---
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts

# --- build: compila y poda a producción ---
FROM deps AS build
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev --ignore-scripts

# --- runtime: superficie mínima ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist         ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
```

```
# .dockerignore
node_modules
dist
coverage
.git
.github
.env*
!.env.example
**/*.spec.ts
**/*.e2e-spec.ts
test
docs
Dockerfile*
docker-compose*
```

```yaml
# docker-compose.prod.yml
name: reservations-prod

x-hardening: &hardening
  restart: unless-stopped
  read_only: true
  tmpfs: [/tmp]
  security_opt: ['no-new-privileges:true']
  cap_drop: [ALL]
  logging:
    driver: json-file
    options: { max-size: '10m', max-file: '3' }

services:
  postgres:
    # Tag + digest: el digest hace la imagen inmutable y verificable.
    image: postgres:18-alpine@sha256:REEMPLAZAR_CON_EL_DIGEST_REAL
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
    secrets: [postgres_password]
    volumes:
      - postgres-data:/var/lib/postgresql # ruta de PG 18
    # Sin `ports`: solo accesible desde la red interna.
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}']
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits: { cpus: '1.0', memory: 1G }

  api:
    <<: *hardening
    image: ghcr.io/${GITHUB_REPOSITORY}/reservations-api:${IMAGE_TAG}
    depends_on:
      postgres: { condition: service_healthy }
    environment:
      NODE_ENV: production
      PORT: '3000'
      DATABASE_URL: postgres://${POSTGRES_USER}@postgres:5432/${POSTGRES_DB}
      FRONTEND_URL: ${FRONTEND_URL}
      BETTER_AUTH_URL: ${API_PUBLIC_URL}
    secrets: [better_auth_secret, postgres_password]
    ports: ['3000:3000']
    deploy:
      replicas: 2 # la constraint EXCLUDE hace esto seguro (§3.4)
      resources:
        limits: { cpus: '1.0', memory: 512M }

secrets:
  postgres_password: { file: ./secrets/postgres_password.txt }
  better_auth_secret: { file: ./secrets/better_auth_secret.txt }

volumes:
  postgres-data:

networks:
  default:
    name: reservations-net
    external: true
```

> **`replicas: 2` no es decorativo.** Es la demostración operativa del diseño: con dos
> instancias de la API compitiendo, la validación en el servicio ya no basta y solo la
> constraint de la base garantiza la invariante. Levantarlo con dos réplicas y ejecutar el
> test de concurrencia contra el balanceador es la prueba más contundente que puedes
> enseñar.

### 5.3 Frontend — desarrollo y producción

```ts
// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone', // imprescindible para una imagen Docker pequeña
  reactStrictMode: true,
  poweredByHeader: false,
};

export default config;
```

```dockerfile
# Dockerfile.dev
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev", "--", "--port", "3001"]
```

```dockerfile
# Dockerfile — producción
# syntax=docker/dockerfile:1.9
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* se hornea en el bundle EN TIEMPO DE BUILD.
# Debe pasarse como build-arg, no como variable de runtime.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/public        ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static  ./.next/static

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
```

> ⚠️ **`NEXT_PUBLIC_API_URL` se congela en tiempo de build.** Es el error más común al
> dockerizar Next: pasarla como `environment:` en el compose de producción no tiene ningún
> efecto sobre el bundle del navegador. O se pasa como `build-arg` (una imagen por
> entorno), o se sirve la configuración desde un endpoint del propio servidor Next. Aquí se
> usa `build-arg`, que es lo simple y suficiente.

```yaml
# docker-compose.yml (frontend) — desarrollo
name: reservations-web-dev

services:
  web:
    build: { context: ., dockerfile: Dockerfile.dev }
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000
      NODE_ENV: development
    ports: ['3001:3001']
    volumes:
      - ./src:/app/src
      - ./public:/app/public
      - /app/node_modules
      - /app/.next

networks:
  default:
    name: reservations-net
    external: true # se une a la red que crea el compose del backend
```

### 5.4 El Makefile — una sola puerta de entrada

Los dos repositorios exponen sus operaciones a través de un `Makefile`. No es
azúcar sintáctico: resuelve tres problemas concretos que un README con una lista de
comandos no resuelve.

**El orden importa y nadie lo recuerda.** Levantar esto de cero son cinco pasos
—construir, esperar a que PostgreSQL acepte conexiones, migrar, sembrar, arrancar— y
hacerlos en otro orden produce errores que no explican nada. `docker compose up` con
la API antes de que la base de datos esté sana da un `ECONNREFUSED`; migrar antes de
que exista el esquema da un error de TypeORM sobre una tabla que nadie mencionó. El
Makefile codifica el orden una vez.

**La documentación de comandos se queda obsoleta; un objetivo que se ejecuta, no.** Un
README que dice `npm run seed` sigue diciéndolo mucho después de que el script se
renombre. Un `make seed` roto se detecta la primera vez que alguien lo usa.

**Iguala el equipo con CI.** `make check` corre exactamente lo mismo que valida el
workflow. Cuando lo que se ejecuta en local y lo que ejecuta CI son dos listas
mantenidas por separado, divergen.

#### El contrato

Un solo comando, desde un clon recién bajado, con Docker como única dependencia:

```bash
make start
```

Sin Node en el equipo, sin `.env` que escribir, sin pasos que recordar. Construye
las imágenes, levanta PostgreSQL, **espera a que la API responda de verdad**, aplica
las migraciones, carga los datos de demostración e imprime las URLs y las
credenciales.

En el frontend el mismo comando comprueba si la API está levantada y la arranca si no
lo está, delegando en el Makefile del backend. Un repositorio que es un cliente debe
poder arrancar su dependencia, o el primer contacto con el proyecto es un
`network reservations-net not found`.

#### Convenciones

```makefile
SHELL := /bin/sh
.DEFAULT_GOAL := help          # make sin argumentos documenta, no ejecuta

.PHONY: help up down start ...  # todos los objetivos son verbos, no ficheros

start: ## Arranque completo desde cero
	...
```

- **`.DEFAULT_GOAL := help`.** `make` a secas lista los objetivos. Un Makefile cuyo
  objetivo por defecto reconstruye medio proyecto es una trampa.
- **`.PHONY` en todos.** Sin él, un objetivo llamado `test` se salta silenciosamente
  cuando existe un directorio `test` —que existe—.
- **La ayuda se genera del propio fichero.** Cada objetivo lleva un comentario `##` y
  `help` los extrae con `awk`. La ayuda no puede desincronizarse porque no está
  duplicada.
- **Espera activa, no `sleep`.** `up` hace polling contra `/health` hasta 120 s en vez
  de dormir un número inventado de segundos. Un `sleep 10` falla en un portátil lento
  y desperdicia ocho segundos en uno rápido.
- **Todo dentro de contenedores.** Los objetivos delegan en `docker compose exec`, así
  que el resultado no depende de qué versión de Node haya en el equipo.

#### Objetivos

|               | Backend                                                              | Frontend                                                       |
| ------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| Arranque      | `start` `up` `down` `stop` `restart` `reset`                         | `start` `up` `down` `stop` `restart` `api-up`                  |
| Base de datos | `migrate` `migrate-revert` `migrate-status` `seed` `db-reset` `psql` | —                                                              |
| Pruebas       | `test` `test-cov` `test-e2e` `verify-overlap` `verify-concurrency`   | `test` `test-cov` `e2e` `e2e-ui`                               |
| Calidad       | `lint` `format` `typecheck` `check` `audit`                          | igual                                                          |
| Otros         | `logs` `shell` `openapi` `build` `prod-up` `release` `clean`         | `logs` `shell` `api-types` `build` `prod-up` `release` `clean` |

`verify-overlap` y `verify-concurrency` merecen estar aquí y no sólo en la suite de
tests: son la demostración de la regla central de la prueba, y que se ejecuten con un
comando de una palabra es parte de la entrega.

#### Sobre Windows

`make` no viene instalado. Se resuelve con `winget install GnuWin32.Make`, con
Chocolatey o desde WSL, y los READMEs incluyen los comandos equivalentes en
`docker compose` por si alguien prefiere no instalar nada. El Makefile es un atajo,
no un requisito: nada de lo que hace es inaccesible sin él.

### 5.5 Versionado semántico y changelog

**`commit-and-tag-version`**: el fork mantenido de `standard-version`, que está
archivado desde 2022. Se corta una versión con `npm run release`, que genera un
commit `chore(release): 0.2.0` y su etiqueta `v0.2.0`.

La cadena completa es corta y cada eslabón existe por una razón:

```
mensaje de commit  →  commitlint  →  commit-and-tag-version  →  CHANGELOG.md + tag + release
   (Conventional)     (lo valida)      (deriva la versión)         (lo publica CI)
```

| Fichero                         | Papel                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `commitlint.config.mjs`         | Valida el mensaje contra Conventional Commits, con `scope-enum` limitado a los módulos reales del proyecto. |
| `.husky/commit-msg`             | Ejecuta `commitlint` en cada commit local.                                                                  |
| `.husky/pre-commit`             | Ejecuta `lint-staged` sobre lo que está en el índice.                                                       |
| `.versionrc.json`               | Configura qué tipos de commit aparecen en el changelog y con qué títulos.                                   |
| `CHANGELOG.md`                  | **Generado, no editado a mano.**                                                                            |
| `.github/workflows/release.yml` | Corta la versión, empuja el tag, crea la release y publica la imagen.                                       |

**Cómo se traduce un commit en una versión:**

| Commit                                                     | Bump                      | Aparece en el changelog  |
| ---------------------------------------------------------- | ------------------------- | ------------------------ |
| `feat(reservations): impedir solapes con EXCLUDE`          | **MINOR** `0.1.0 → 0.2.0` | Sí, en _Funcionalidades_ |
| `fix(availability): el hueco de la frontera se descartaba` | **PATCH** `0.2.0 → 0.2.1` | Sí, en _Correcciones_    |
| `perf(reservations): usar el índice GiST parcial`          | **PATCH**                 | Sí, en _Rendimiento_     |
| `refactor:`, `test:`, `style:`, `ci:`, `chore:`            | ninguno                   | No                       |
| Cuerpo con `BREAKING CHANGE: ...`                          | **MAJOR** `0.2.1 → 1.0.0` | Sí, destacado            |

> **Por qué `commitlint` no es policía de estilo.** La versión se _deriva_ de estos
> mensajes. Un cambio real de funcionalidad etiquetado `chore` produce un número de
> versión equivocado y un changelog que engaña a quien actualiza. El hook local y el job
> `commits` del CI —que además cubre los commits empujados con `--no-verify`— existen
> para eso, no por gusto estético.

```jsonc
// package.json — scripts, alineados con los del CRM
{
  "scripts": {
    "release": "commit-and-tag-version",
    "release:dry": "commit-and-tag-version --dry-run",
    "release:minor": "commit-and-tag-version --release-as minor",
    "prepare": "husky",
  },
}
```

El proyecto arranca en **`0.1.0`** y no llega a `1.0.0` durante la prueba: `0.x` comunica
con honestidad que la API todavía puede cambiar. Cada fase del plan (§7) cierra en un
commit convencional, así que **el `CHANGELOG.md` acaba siendo el registro legible del
trabajo** &mdash;y eso es exactamente lo que un evaluador mira antes de leer código&mdash;.

### 5.6 GitHub Actions

Cuatro ficheros por repositorio, ya escritos y con el YAML validado:

| Fichero                         | Cuándo corre                   | Qué hace                                                      |
| ------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| `.github/workflows/ci.yml`      | push y PR a `main` / `develop` | Los _quality gates_. Ver tabla de jobs abajo.                 |
| `.github/workflows/release.yml` | manual (`workflow_dispatch`)   | Versiona, tagea, crea la release y publica la imagen en GHCR. |
| `.github/dependabot.yml`        | semanal                        | Actualiza npm, actions y Docker **con cooldown de 7 días**.   |
| `.husky/*`                      | local                          | Valida antes de que nada llegue a CI.                         |

**Jobs del CI del backend:**

| Job         | Depende de        | Qué comprueba                                                                                    |
| ----------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `quality`   | &mdash;           | `lint:check`, `format:check`, `typecheck`. Rápido y sin servicios: falla pronto.                 |
| `security`  | &mdash;           | `audit:signatures`, `audit:vulns`, `audit:osv` (§2).                                             |
| `test-unit` | &mdash;           | `test:cov` y sube el informe de cobertura como artefacto.                                        |
| `test-e2e`  | `quality`         | **PostgreSQL 18 real** como _service container_, con `healthcheck`. Migraciones y suite e2e.     |
| `docker`    | `quality`         | Construye la imagen de producción con SBOM y procedencia, y la escanea con Trivy. No la publica. |
| `commits`   | &mdash; (solo PR) | `commitlint` sobre el rango del PR. Caza lo que se empujó con `--no-verify`.                     |

En el frontend los jobs son `quality`, `security`, `test`, `build`, `e2e` y `commits`. El
de Playwright **no corre en cada push**: necesita el stack completo, así que se dispara a
mano o etiquetando el PR con `e2e`. Fingir lo contrario haría el CI lento y frágil por una
cobertura que en local se obtiene con un comando.

**Detalles que evitan fallos reales:**

- `concurrency` con `cancel-in-progress`: un push nuevo cancela la ejecución anterior del
  mismo _ref_ en lugar de pagar las dos.
- El service container de Postgres lleva `--health-cmd pg_isready`. Sin eso, el job
  compite con el arranque de la base y falla de forma intermitente.
- `permissions: contents: read` por defecto; solo `release.yml` sube a `contents: write`
  y `packages: write`, y únicamente en los jobs que lo necesitan.
- `npm ci --ignore-scripts` en **todos** los jobs. Playwright es la única excepción:
  necesita su script para bajar los navegadores, y se rehabilita en ese paso concreto.
- **Todas las actions fijadas por SHA.** Resueltas el 2026-09-01:

| Action                       | Versión | SHA fijado                                 |
| ---------------------------- | ------- | ------------------------------------------ |
| `actions/checkout`           | v7.0.1  | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node`         | v7.0.0  | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/upload-artifact`    | v7.0.1  | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
| `docker/setup-buildx-action` | v4.3.0  | `37fe631027851001ddb9b187196cc803df7f5f0e` |
| `docker/build-push-action`   | v7.3.0  | `53b7df96c91f9c12dcc8a07bcb9ccacbed38856a` |
| `docker/login-action`        | v4.6.0  | `dbcb813823bdd20940b903addbd779551569679f` |
| `aquasecurity/trivy-action`  | v0.36.0 | `ed142fd0673e97e23eac54620cfb913e5ce36c25` |

**Cortar una versión**, una vez el trabajo está en `main`:

```bash
npm run release:dry   # previsualiza versión y changelog sin tocar nada
npm run release       # bump + CHANGELOG.md + commit + tag
git push --follow-tags origin main
```

O desde GitHub: _Actions → Release → Run workflow_, con la opción **dry-run** marcada la
primera vez. El workflow rechaza cortar una versión si `lint`, `typecheck` o los tests
fallan: **nunca se libera desde un árbol en rojo.**

---

## 6. Estrategia de pruebas

El enunciado dice: _"queremos ver cómo la resuelves y **cómo la pruebas**"_. Las pruebas son
la mitad del entregable.

### 6.1 Backend

| Nivel                         | Herramientas               | Qué cubre                                                               | Nº aprox. |
| ----------------------------- | -------------------------- | ----------------------------------------------------------------------- | --------: |
| Unitarias, sin E/S            | Jest 30 + fakes en memoria | `Period`, `subtractIntervals`, cada regla por separado, los servicios.  |       ~70 |
| Integración con Postgres real | Jest + Testcontainers 12   | Repositorios, la constraint, migraciones `up`/`down`, el advisory lock. |       ~25 |
| End-to-end HTTP               | Supertest + Testcontainers | Flujos completos con sesión real: crear, filtrar, cancelar, permisos.   |       ~20 |
| **Concurrencia**              | Supertest + `Promise.all`  | La prueba que demuestra que la solución es real.                        |         3 |

```ts
// test/unit/overlap.spec.ts — la tabla de §3.4, convertida en test
// Existente: 2026-09-15 de 10:00 a 11:00 UTC.
describe.each([
  ['a · justo antes', '09:00', '10:00', false], // frontera: NO choca
  ['b · justo después', '11:00', '12:00', false], // frontera: NO choca
  ['c · pisa el inicio', '09:30', '10:30', true],
  ['d · pisa el final', '10:30', '11:30', true],
  ['e · contenida', '10:15', '10:45', true],
  ['f · envolvente', '09:30', '11:30', true],
  ['g · idéntica', '10:00', '11:00', true],
])('%s', (_, startAt, endAt, expectsConflict) => {
  it(expectsConflict ? 'is rejected with 409' : 'is accepted', async () => {
    const result = await createReservation({ resourceId: room.id, startAt, endAt });
    expect(result.hasConflict).toBe(expectsConflict);
  });
});
// El mismo array se reutiliza en integración insertando por SQL directo:
// prueba la GARANTÍA (capa 3), no solo la comprobación (capa 2).
```

```ts
// test/e2e/concurrency.e2e-spec.ts — la prueba estrella
it('with 25 simultaneous requests for the same slot, exactly one wins', async () => {
  const payload = {
    resourceId: room.id,
    title: 'Comité',
    startAt: '2026-09-15T10:00:00Z',
    endAt: '2026-09-15T11:00:00Z',
  };

  // Sin Idempotency-Key: son 25 intentos genuinamente distintos compitiendo.
  const responses = await Promise.all(
    Array.from({ length: 25 }, () =>
      request(app.getHttpServer())
        .post('/api/v1/reservations')
        .set('Cookie', sessionCookie)
        .send(payload),
    ),
  );

  expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
  expect(responses.filter((r) => r.status === 409)).toHaveLength(24);

  // Y la verdad última: la base de datos.
  expect(await countConfirmed(room.id)).toBe(1);
});

it('the constraint holds even when the application layer is bypassed', async () => {
  await sql(`INSERT INTO reservation (...) VALUES (...)`); // 10:00–11:00 OK
  await expect(sql(`INSERT INTO reservation (...) VALUES (...)`)) // 10:30–11:30
    .rejects.toMatchObject({ code: '23P01' });
});

it('a cancelled reservation frees the slot', async () => {
  await cancel(existingReservation.id);
  await expect(createReservation(sameSlot)).resolves.toHaveProperty('status', 201);
});
```

**Umbrales en CI, no como aspiración:**

```ts
// jest.config.ts
coverageThreshold: {
  global: { branches: 80, functions: 85, lines: 85, statements: 85 },
  // La regla central y su value object: sin excusas, cobertura total.
  './src/reservations/rules/**':   { branches: 100, functions: 100, lines: 100, statements: 100 },
  './src/reservations/period.vo.ts': { branches: 100, functions: 100, lines: 100, statements: 100 },
}
```

Se prueba contra un Postgres **real** vía Testcontainers, nunca SQLite en memoria: la
constraint de exclusión _solo existe en PostgreSQL_, así que probarla en otro motor haría
que la prueba principal no probara nada.

### 6.2 Frontend

| Nivel       | Herramientas                   | Qué cubre                                                                           | Nº aprox. |
| ----------- | ------------------------------ | ----------------------------------------------------------------------------------- | --------: |
| Unitarias   | Vitest 4 + jsdom               | `lib/dates.ts` con TZ fijada, `lib/api/errors.ts`, mapeo de filtros a query string. |       ~20 |
| Componentes | Vitest + Testing Library + MSW | `BookingDialog`, `ReservationFilters`, `ResourcesTable`, `StatusChip`.              |       ~18 |
| End-to-end  | Playwright 1.62                | Dos recorridos contra el stack real en Docker.                                      |         4 |

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'], // jest-dom + servidor MSW
    globals: true,
    // Zona horaria fija: sin esto, los tests de fechas pasan en tu máquina y
    // fallan en CI. Es el fallo más común de una app de reservas.
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      thresholds: { lines: 70, functions: 70, branches: 65, statements: 70 },
      exclude: ['src/lib/api/schema.d.ts', 'src/app/**/layout.tsx'],
    },
  },
});
```

```tsx
// test/components/booking-dialog.test.tsx — el test que importa del front
describe('BookingDialog', () => {
  it('sends the selected slot and closes on success', async () => {
    server.use(
      http.post('*/api/v1/reservations', () => HttpResponse.json({ id: 'r-1' }, { status: 201 })),
    );

    render(<BookingDialog resource={room} open onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /10:00 – 11:00/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the conflicting slot and keeps the dialog open on 409', async () => {
    server.use(
      http.post('*/api/v1/reservations', () =>
        HttpResponse.json(
          {
            title: 'El recurso ya está reservado en ese horario',
            code: 'OVERLAPPING_RESERVATION',
            conflict: { startAt: '2026-09-15T10:00:00Z', endAt: '2026-09-15T11:00:00Z' },
          },
          { status: 409 },
        ),
      ),
    );

    render(<BookingDialog resource={room} open onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    // Texto en español: es lo que ve el usuario.
    expect(await screen.findByRole('alert')).toHaveTextContent(/ya está reservado/i);
    expect(onClose).not.toHaveBeenCalled();
    // Y ofrece alternativas en lugar de solo rechazar.
    expect(screen.getByText('Otros horarios disponibles')).toBeInTheDocument();
  });

  it('does not submit twice on a double click', async () => {
    const spy = vi.fn(() => HttpResponse.json({ id: 'r-1' }, { status: 201 }));
    server.use(http.post('*/api/v1/reservations', spy));

    render(<BookingDialog resource={room} open onClose={onClose} />);
    const confirm = screen.getByRole('button', { name: 'Confirmar reserva' });
    await userEvent.dblClick(confirm);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
```

```ts
// e2e/booking.spec.ts — Playwright contra el stack real
test('reserva un hueco libre y lo ve en su listado', async ({ page }) => {
  await login(page, 'user@example.com');
  await page.goto('/resources');
  await page.getByRole('link', { name: 'Sala Aurora' }).click();
  await page.getByRole('button', { name: '10:00 – 11:00' }).click();
  await page.getByLabel('Título').fill('Comité semanal');
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();

  await expect(page.getByText('Reserva confirmada')).toBeVisible();
  await page.goto('/reservations');
  await expect(page.getByRole('cell', { name: 'Comité semanal' })).toBeVisible();
});

test('muestra el conflicto al intentar un horario ocupado', async ({ page }) => {
  await login(page, 'other@example.com');
  await page.goto('/resources/aurora');
  await page.getByRole('button', { name: 'Reservar otro horario' }).click();
  await page.getByLabel('Desde').fill('10:30');
  await page.getByLabel('Hasta').fill('11:30');
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();

  await expect(page.getByRole('alert')).toContainText('ya está reservado');
});
```

---

## 7. Plan por fases

Dieciséis fases en orden de dependencia. Cada una acaba en un commit convencional y en algo
que se puede _enseñar_. La columna **núcleo** marca lo que el enunciado exige de forma
explícita.

| Fase                          | Entregable                                                                                                                                     | Criterio de aceptación                                                                                   | Núcleo |   h |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | :----: | --: |
| **F0** · Cimientos            | Repos, TS estricto, ESLint + Prettier, `.npmrc` con cooldown. **Husky + commitlint + `commit-and-tag-version` desde el primer commit** (§5.5). | `npm ci` reproduce el árbol; un commit mal formado se rechaza en local.                                  |   ✅   |   3 |
| **F1** · Docker de desarrollo | `Dockerfile.dev`, `docker-compose.yml`, Postgres 18 con volumen correcto, init SQL.                                                            | `docker compose up` y la API responde `/health`.                                                         |   ✅   |   3 |
| **F2** · Esquema              | Las cuatro migraciones: `btree_gist`, columna generada, constraint, índices.                                                                   | `migration:run` y `migration:revert` sobre base limpia.                                                  |   ✅   |   3 |
| **F3** · Autenticación        | Puerto `AuthProvider` + `BetterAuthProvider` + guards + decoradores propios + regla de ESLint + **tests de contrato** (§3.10). Seed de admin.  | Login devuelve cookie; un endpoint protegido da 401 sin ella; `FakeAuthProvider` pasa el mismo contrato. |        |   4 |
| **F4** · Catálogo             | CRUD de tipos y recursos, baja lógica, validación con ajv.                                                                                     | Atributos que no cumplen el esquema del tipo → 422.                                                      |   ✅   |   3 |
| **F5** · Crear reserva        | `Period`, motor de reglas, advisory lock, traducción de `23P01`. **El corazón.**                                                               | Los siete casos pasan; un solape da 409 con el conflicto.                                                |   ✅   |   5 |
| **F6** · Disponibilidad       | `subtractIntervals`, ventanas operativas, bloqueos, endpoint.                                                                                  | Con una reserva de 10 a 11, ese hueco no aparece.                                                        |   ✅   |   3 |
| **F7** · Listar y cancelar    | Filtros, paginación, orden, cancelación idempotente, reprogramación.                                                                           | Cancelar libera el hueco; los cuatro filtros combinan.                                                   |   ✅   |   3 |
| **F8** · Pruebas de backend   | Testcontainers, suite de solape, **test de concurrencia**, umbrales en CI.                                                                     | 25 peticiones simultáneas → exactamente un 201.                                                          |   ✅   |   4 |
| **F9** · Docker de producción | `Dockerfile` multi-stage, `docker-compose.prod.yml`, hardening, healthchecks.                                                                  | La imagen arranca sin root; `replicas: 2` pasa el test de concurrencia.                                  |        |   3 |
| **F10** · CI/CD y release     | `ci.yml` y `release.yml` con actions fijadas por SHA, Dependabot con cooldown, `audit:osv`, Trivy y SBOM (§5.6).                               | Los seis jobs pasan; `release:dry` produce la versión y el changelog correctos.                          |        |   3 |
| **F11** · Documentación       | Swagger completo, seeds, colección de Bruno, README con decisiones.                                                                            | Un evaluador clona, ejecuta un comando y prueba la API.                                                  |   ✅   |   3 |
| **F12** · Base del front      | Next 16, tema MUI, cliente generado, `i18n/es.ts`, login, shell, Docker.                                                                       | Se entra con el usuario del seed y se llega a una pantalla autenticada.                                  |        |   3 |
| **F13** · Recursos            | DataGrid, alta y edición, formulario dinámico según el JSON Schema.                                                                            | Se crea una sala desde la interfaz y aparece en la lista.                                                |        |   3 |
| **F14** · Reservas            | Listado con filtros, `BookingDialog`, huecos libres, manejo del 409, cancelar.                                                                 | Reservar un hueco ocupado muestra el conflicto y ofrece alternativas.                                    |        |   4 |
| **F15** · Pruebas de front    | Vitest + RTL + MSW, agenda semanal, accesibilidad, Playwright.                                                                                 | Los cuatro recorridos de Playwright pasan en CI.                                                         |        |   4 |
| **F16** · Reflexión           | El documento del enunciado. **Se escribe al final pero se anota desde F0.**                                                                    | Cubre los seis puntos de §8.                                                                             |   ✅   |   3 |

**Total ≈ 57 h · solo núcleo ≈ 33 h**

### 7.1 Trabajar con IA de forma que se pueda contar

El enunciado quiere observar cómo trabajas con IA, y eso solo se enseña si queda rastro.
Durante todas las fases, mantén un `NOTES.md` **fuera del control de versiones** donde
anotes, en una línea, cada vez que: aceptaste una sugerencia sin cambios, la corregiste y
por qué, o la descartaste. En F16 ese fichero es el borrador del documento reflexivo.

Dos hábitos que dan material concreto: pide a la IA que **ataque** tu propio diseño
(_"¿qué se rompe con dos instancias de la API?"_) en vez de solo generar código, y
**escribe tú los tests de la regla central antes de generar su implementación**.

---

## 8. Documento reflexivo

Seis secciones, dos páginas y media, en prosa. La mayoría de candidatos describe lo que
hizo; la versión que destaca explica **lo que descartó**.

| Sección                                            | Qué contar                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. El problema tal como lo entendí**             | Que no va de un CRUD sino de **una invariante bajo concurrencia**. Por qué el dominio genérico multi-tipo no era complejidad gratis. El alcance que dejaste fuera y por qué.                                                                                                                                                        |
| **2. La decisión central**                         | Las tres capas y el matiz que las justifica: **la constraint garantiza, el lock explica**. Por qué `'[)'`. Por qué descartaste `SERIALIZABLE`.                                                                                                                                                                                      |
| **2b. Dónde pusiste las abstracciones**            | Que descartaste `domain/application/infrastructure` por sobre-ingeniería a esta escala, y que aun así conservaste **dos** puertos: las reglas y el proveedor de identidad (§3.10). Saber dónde _no_ abstraer se lee mejor que abstraerlo todo. Cuenta también que descartaste el paquete comunitario de auth por 40 líneas propias. |
| **3. Cómo lo probé**                               | Los siete casos frontera y por qué _a_ y _b_ son los interesantes. El test de las 25 peticiones y qué habría fallado sin el lock. Por qué Testcontainers y no un doble en memoria.                                                                                                                                                  |
| **4. Dependencias y cadena de suministro**         | El cooldown de 7 días, y la consecuencia asumida: **20 de 55 paquetes fijados a una versión que no es la última, NestJS 11 en lugar del 12 publicado hace 4 días**. `class-transformer` sin mantenimiento desde 2021 y cómo lo mitigaste. Esta sección casi nadie la escribe.                                                       |
| **5. Trabajar con IA**                             | Concreto y honesto, con ejemplos reales de tu `NOTES.md`. Dónde aceleró y **dónde te dio algo plausible pero incorrecto** —casi seguro, una comprobación de solape solo en el servicio, o la frontera `end == start` mal tratada—, cómo lo detectaste y qué hiciste.                                                                |
| **6. Lo que falta y qué haría con una semana más** | Sin excusas: paginación por offset en lugar de cursor, sin auditoría de cambios, sin rate limiting, cobertura de front deliberadamente ligera. Después, priorizado: reservas recurrentes, lista de espera sobre huecos liberados, métricas de ocupación.                                                                            |

> **El detalle que casi nadie incluye.** Una sección corta titulada _"Un error que cometí"_.
> Elige uno real —el más probable es haber tratado la frontera `end == start` como
> conflicto hasta que el test parametrizado lo delató—, cuenta cómo lo encontraste y qué
> cambiaste. Un candidato que sabe depurar su propio razonamiento vale más que uno cuyo
> código simplemente funcionó.

---

## 9. Checklist de entrega

| Requisito del enunciado                | Dónde queda resuelto                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| Modela recursos, usuarios y reservas   | §3.2 — `resource_type` + `resource`, `user` de Better Auth, `reservation`.            |
| **Sin solapes entre reservas activas** | §3.4 — tres capas; §6.1 — siete casos frontera y prueba de concurrencia.              |
| Consultar disponibilidad en un rango   | §3.6 — `GET /resources/:id/availability`.                                             |
| Cancelar una reserva                   | §3.7 — `POST /reservations/:id/cancellation`, idempotente y con motivo.               |
| Listar con filtros y paginación        | §3.7 — recurso, usuario, rango, estado + `page`/`limit`.                              |
| CRUD de recursos con baja              | §3.7 — baja lógica que protege el histórico.                                          |
| Autenticación _(opcional, suma)_       | §3.10 — Better Auth tras un adaptador, con sesiones y roles, compartido con el front. |
| Documento reflexivo                    | §8 — seis secciones, con la de IA sustentada en notas reales.                         |

### Lo que se entrega

- Dos repositorios con historia de commits legible: una fase, un commit convencional, y un
  `CHANGELOG.md` generado a partir de ellos. **El historial es parte de lo que se evalúa**, y
  aquí además se lee como un documento.
- README del backend: arranque en un comando, decisiones con sus alternativas descartadas,
  cómo correr cada nivel de pruebas, la tabla de los siete casos frontera.
- Captura o GIF de la suite de concurrencia en verde. Es la prueba más convincente del
  repositorio y no debería haber que buscarla.
- `REFLECTION.md` en el repositorio del backend, enlazado desde el README.
- Colección de Bruno o Postman con la secuencia completa: login → crear recurso →
  consultar huecos → reservar → **intentar solapar y ver el 409** → cancelar → comprobar
  que el hueco volvió.

### Antes de enviar

Clona tus propios repositorios en una carpeta limpia y sigue tu README al pie de la letra,
sin usar nada de tu entorno. Si `docker compose up` más un comando no dejan la API
respondiendo con datos de ejemplo, arréglalo: es lo primero que hará quien te evalúe, y es
la única parte del trabajo que se juzga antes de leer una línea de tu código.

---

_Última verificación de versiones y vulnerabilidades: 2026-09-01._
_Revalidar con `npm run audit:osv` antes de entregar._

---

## Apéndice A — Notas operativas descubiertas al implementar

Cosas que solo aparecen ejecutando, anotadas aquí para no volver a tropezar.

| Síntoma                                                                                            | Causa                                                                                                                                                                                                                  | Solución                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHANGELOG.md` con la cabecera duplicada tras la primera release                                   | `commit-and-tag-version` **antepone** su cabecera; no reemplaza la existente. Un fichero semilla con texto propio queda debajo.                                                                                        | Sembrar `CHANGELOG.md` **vacío**. La nota de «fichero generado» va en `header` dentro de `.versionrc.json`, que es lo que sobrevive a cada release.                                         |
| Los hooks de git no se ejecutan                                                                    | `npm ci --ignore-scripts` (política de §2) salta el script `prepare`, que es el que instala husky.                                                                                                                     | Ejecutar `npm run prepare` una vez tras el primer install. Es el precio de `ignore-scripts`, y es barato.                                                                                   |
| `MODULE_NOT_FOUND: './app.module'` en el contenedor                                                | `incremental: true` + `deleteOutDir: true`: se borra `dist` pero sobrevive el `.tsbuildinfo`, así que la build incremental no emite nada.                                                                              | `tsBuildInfoFile` dentro de `dist`.                                                                                                                                                         |
| Editar `tsconfig.json` no tiene efecto en Docker                                                   | Solo `src/` estaba bind-mounteado.                                                                                                                                                                                     | Montar también `tsconfig*.json` y `nest-cli.json` (§5.1).                                                                                                                                   |
| Todo `POST` responde 400 con «todos los campos faltan»                                             | `bodyParser: false` desactiva el parser de **toda** la app, no solo de `/api/auth`.                                                                                                                                    | Reactivar `express.json()` salvo para `/api/auth` (§3.7).                                                                                                                                   |
| La app no arranca: «circular dependency (property key: data)»                                      | Swagger no resuelve el genérico `T` de `PaginatedResponseDto`.                                                                                                                                                         | Declarar `data` explícito como array de objetos; `allOf` compone el tipo real.                                                                                                              |
| `sign-up` da 500: `column "issuer" does not exist`                                                 | `@better-auth/cli` empaqueta better-auth 1.6.21; la 1.7 añadió la columna.                                                                                                                                             | Obtener el delta de `getMigrations()` del paquete instalado, no del CLI (§3.10).                                                                                                            |
| El seed falla con `Nest can't resolve dependencies (?, +, +, ...)` bajo `tsx` **y** bajo `ts-node` | El mismo código compilado con `nest build` arranca perfectamente. La DI de Nest lee `design:paramtypes`, y los transpiladores que resuelven fichero a fichero no lo emiten igual que `tsc` sobre el proyecto completo. | Que `seed:dev` sea `nest build && node dist/database/seeds/run-seeds.js`. Cualquier script que arranque un contexto de Nest debe correr sobre el artefacto compilado, no sobre las fuentes. |
| `make test` en el frontend: `Cannot find module '/app/test/setup.ts'`                              | `.dockerignore` excluye `test/` de la imagen —correctamente: una imagen de producción no debe llevar tests— y el compose no lo bind-mounteaba.                                                                         | Montar `./test` y `vitest.config.ts` en `docker-compose.yml`. Excluirlos de la imagen y montarlos en desarrollo no es contradictorio: son dos necesidades distintas.                        |
| `make start` en el frontend: `ports are not available: 0.0.0.0:3001`                               | Un servidor de desarrollo corriendo en el host ocupa el puerto que quiere el contenedor.                                                                                                                               | Parar el proceso del host. Vale la pena elegir: o se desarrolla en contenedores o en el host, pero las dos cosas a la vez compiten por los mismos puertos.                                  |
