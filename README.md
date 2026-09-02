# Reservations API

API para reservar recursos compartidos: salas, portátiles, vehículos y cualquier
otro tipo que se dé de alta.

La regla central es que **dos reservas activas no pueden solaparse sobre el mismo
recurso**. Todo lo demás en este repositorio es consecuencia de tomarse esa
frase en serio.

- **Stack**: NestJS 11 · TypeScript 6 · PostgreSQL 18 · TypeORM · Better Auth
- **Interfaz**: [test-reservation-frontend](../test-reservation-frontend) (Next.js 16 + MUI)

---

## Arranque

Sólo hace falta Docker. Ni Node en el equipo, ni fichero `.env` que escribir, ni
orden de pasos que recordar.

```bash
make start
```

Eso construye las imágenes, levanta PostgreSQL, espera a que acepte conexiones,
aplica las diez migraciones, carga datos de demostración y deja la API
escuchando.

| Servicio | URL                          |                                                     |
| -------- | ---------------------------- | --------------------------------------------------- |
| API      | http://localhost:3000/api/v1 |                                                     |
| Swagger  | http://localhost:3000/docs   | documentación interactiva                           |
| Adminer  | http://localhost:8080        | servidor `postgres`, usuario y clave `reservations` |

Usuarios de demostración, todos con la contraseña `Reservas2026!`:

| Correo                | Rol   |
| --------------------- | ----- |
| `admin@reservas.dev`  | admin |
| `carlos@reservas.dev` | user  |
| `marta@reservas.dev`  | user  |

Para ver la interfaz completa, arranca también el repositorio del frontend
(su `make start` levanta este si hace falta).

### Si no tienes `make`

Es un envoltorio, no un requisito. Lo mismo a mano:

```bash
docker compose up -d --build
docker compose exec api npm run migration:run:dev
docker compose exec api npm run seed:dev
```

En Windows, `make` se instala con `winget install GnuWin32.Make`, con Chocolatey
(`choco install make`) o usando WSL.

---

## Comandos

`make` sin argumentos lista todo. Los que se usan a diario:

| Comando                   | Qué hace                                            |
| ------------------------- | --------------------------------------------------- |
| `make start`              | Arranque completo desde cero                        |
| `make reset`              | Borra la base de datos y vuelve a empezar           |
| `make logs-api`           | Sigue los logs de la API                            |
| `make psql`               | Consola SQL                                         |
| `make test`               | Tests unitarios                                     |
| `make check`              | Lo mismo que valida CI: tipos, lint y tests         |
| `make verify-overlap`     | Demuestra la restricción de solapamiento por SQL    |
| `make verify-concurrency` | 25 reservas simultáneas: debe ganar exactamente una |

---

## La regla central

El requisito es una sola frase, pero admite muchas implementaciones y casi todas
están mal. Ésta usa **tres capas**, y sólo la tercera es una garantía.

### 1. El objeto de valor `Period` — la forma

[`src/reservations/period.vo.ts`](src/reservations/period.vo.ts)

Un rango inválido no llega a existir: el constructor es privado y `create()`
valida que el fin sea posterior al inicio, que la duración esté dentro de los
límites y que los minutos caigan en la granularidad permitida. Un `Period` mal
formado no es algo que se detecte, es algo que no se puede construir.

Los intervalos son **semiabiertos**, `[inicio, fin)`. Una reserva de 10:00 a
11:00 y otra de 11:00 a 12:00 no se solapan. Esta decisión se repite idéntica en
las tres capas, y es la única forma de que las tres estén de acuerdo.

### 2. Bloqueo y reglas de negocio — el mensaje útil

[`src/reservations/services/reservation.service.ts`](src/reservations/services/reservation.service.ts)

Dentro de la transacción se toma un `pg_advisory_xact_lock` por recurso. Eso
serializa las reservas _de ese recurso_ sin serializar la API entera, que es lo
que pasaría con un nivel de aislamiento `SERIALIZABLE`.

Con el bloqueo tomado se ejecutan siete reglas, cada una en su clase, ordenadas
de más barata a más cara:

```
ResourceIsActiveRule → NotInThePastRule → SufficientCapacityRule
→ WithinOperatingHoursRule → NoResourceBlockRule → NoOverlapRule
→ ActiveReservationLimitRule
```

Añadir una regla es añadir una clase y una línea en el módulo. El servicio no se
toca: principio abierto/cerrado como algo que se puede señalar, no afirmar.

Esta capa es la que produce un 409 que dice _qué_ franja choca. No es la que
garantiza nada.

### 3. La restricción `EXCLUDE` — la garantía

[`src/database/migrations/1756700000004-Reservations.ts`](src/database/migrations/1756700000004-Reservations.ts)

```sql
period tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED,

CONSTRAINT reservation_no_overlap EXCLUDE USING gist (
  resource_id WITH =,
  period      WITH &&
) WHERE (status = 'CONFIRMED')
```

Esto es lo que hace que el requisito se cumpla siempre. No importa cuántas
instancias de la API haya, ni si alguien inserta a mano por `psql`, ni si una
futura refactorización se olvida de llamar a las reglas: PostgreSQL rechaza la
fila.

Tres detalles que la hacen funcionar:

- `WHERE (status = 'CONFIRMED')` la hace **parcial**. Cancelar libera la franja
  en el mismo instante, y una reserva cancelada puede convivir con la confirmada
  que ocupa su hueco.
- `period` es una columna **generada**, propiedad de la base de datos. No puede
  desviarse de las dos columnas de las que deriva porque nadie la escribe.
- Mezclar `=` sobre un `uuid` con `&&` sobre un rango en un único índice GiST
  requiere la extensión `btree_gist`, que crea la migración 1.

El error `23P01` se traduce a `OverlappingReservationError` y de ahí a un 409.

### Cómo se comprueba

Dos verificaciones, deliberadamente distintas:

```bash
make verify-overlap      # SQL directo, saltándose la API
make verify-concurrency  # 25 POST simultáneos por HTTP
```

La primera importa precisamente porque **no** pasa por el código de aplicación:
si la garantía dependiera del servicio, esta prueba no demostraría nada. Cubre
siete casos frontera, incluido el contiguo (`10-11` y `11-12`, que debe
aceptarse) y el de cancelación.

La segunda lanza 25 peticiones a la vez sobre la misma franja. El resultado
esperado es exactamente un `201` y veinticuatro `409`, con una sola fila
`CONFIRMED` en la tabla.

---

## Endpoints

Todo bajo `/api/v1`. La referencia viva y ejecutable está en
[http://localhost:3000/docs](http://localhost:3000/docs).

### Reservas

| Método  | Ruta                             |                                  |
| ------- | -------------------------------- | -------------------------------- |
| `POST`  | `/reservations`                  | Crear. Acepta `Idempotency-Key`  |
| `GET`   | `/reservations`                  | Listado con filtros y paginación |
| `GET`   | `/reservations/:id`              | Detalle                          |
| `PATCH` | `/reservations/:id`              | Reprogramar                      |
| `POST`  | `/reservations/:id/cancellation` | Cancelar                         |

Filtros del listado: `resourceId`, `userId`, `status` (repetible), `from`, `to`,
`page`, `limit`.

La cancelación es un `POST` que crea un hecho, no un `DELETE`. No se borra nada:
quedan registrados quién canceló, cuándo y por qué, y la franja se libera al
instante.

### Recursos

| Método   | Ruta                          |                               |
| -------- | ----------------------------- | ----------------------------- |
| `GET`    | `/resources`                  | Listado                       |
| `GET`    | `/resources/:id`              | Detalle                       |
| `POST`   | `/resources`                  | Alta                          |
| `PATCH`  | `/resources/:id`              | Edición                       |
| `DELETE` | `/resources/:id`              | Baja lógica                   |
| `POST`   | `/resources/:id/activation`   | Reactivación                  |
| `GET`    | `/resources/:id/availability` | **Huecos libres en un rango** |

`DELETE` desactiva, no borra. Un recurso con reservas históricas nunca se
elimina: hacerlo las dejaría huérfanas, y la clave foránea con `RESTRICT` lo
rechazaría de todos modos.

`/availability` parte del horario operativo del recurso y le resta bloqueos y
reservas confirmadas. Acepta `from`, `to` y `minDurationMinutes`, y el rango está
limitado a 60 días: pedir un año de huecos es una denegación de servicio
disfrazada de consulta.

### Usuarios y catálogo

| Método              | Ruta              |                        |
| ------------------- | ----------------- | ---------------------- |
| `GET`               | `/users`          | Listado (admin)        |
| `POST`              | `/users`          | Alta (admin)           |
| `PATCH`             | `/users/:id`      | Editar nombre y correo |
| `PATCH`             | `/users/:id/role` | Cambiar rol            |
| `POST` `/` `DELETE` | `/users/:id/ban`  | Bloquear y desbloquear |
| `GET` `/` `POST`    | `/resource-types` | Catálogo de tipos      |

---

## Estructura

Un directorio por módulo de negocio, y dentro la separación por
responsabilidad —la misma forma en los cuatro:

```
src/
├── auth/                    Identidad: puerto, adaptadores, guardas
│   ├── ports/               AuthProvider: toda la superficie de acoplamiento
│   ├── providers/           better-auth.provider.ts, fake-auth.provider.ts
│   ├── guards/              Autenticación y autorización, globales
│   └── decorators/          @Public(), @Roles(), @CurrentUser()
├── common/                  Errores RFC 7807, paginación, utilidades
├── config/                  Validación del entorno con zod, Swagger
├── database/
│   ├── migrations/          Diez, numeradas y ordenadas
│   └── seeds/               Datos de demostración, idempotentes
├── reservations/            controllers · dtos · entities · repositories
│   ├── rules/               Una clase por regla de negocio
│   ├── services/            reservation · availability · lock · clock
│   ├── utils/               Aritmética de intervalos, pura
│   └── period.vo.ts         El objeto de valor
├── resources/               controllers · dtos · entities · repositories · services
├── users/                   controllers · dtos · entities · repositories · services
└── health/
```

### Por qué la autenticación está detrás de un puerto

Better Auth resuelve mucho, pero es una dependencia joven en una parte del
sistema que es cara de cambiar. Toda la superficie de acoplamiento cabe en una
interfaz:

```ts
export interface AuthProvider {
  readonly name: string;
  authenticate(headers: Headers): Promise<AuthenticatedUser | null>;
  getRequestHandler(): RequestHandler | null;
  createAccount?(input: NewAccount): Promise<{ id: string }>;
}
```

Nada fuera de `src/auth/` importa `better-auth` —lo impide una regla de ESLint,
no una convención—. Sustituirlo por Auth0, Keycloak o un SSO corporativo es
escribir una clase nueva y cambiar una variable de entorno. El
`auth-provider.contract.ts` es un test de contrato que cualquier implementación
debe pasar, así que el sustituto se valida antes de enchufarlo.

`createAccount` es opcional a propósito: un proveedor respaldado por SSO
corporativo no puede crear cuentas, y la API responde 501 en vez de fingir que
el intento falló.

---

## Tests

```bash
make test       # 57 unitarios
make test-e2e   # end-to-end con Testcontainers
make check      # tipos + lint + tests, lo mismo que CI
```

Los e2e levantan su propio PostgreSQL con Testcontainers en lugar de reutilizar
el de desarrollo: un test que depende del estado que le dejó el anterior es un
test que falla los martes.

Lo que se prueba y por qué:

- **`Period`** — casos frontera de la semiapertura, granularidad y duración.
- **`subtractIntervals`** — la aritmética de huecos, con solapes entre
  intervalos ocupados y el caso contiguo que no debe generar un hueco fantasma.
- **Cada regla**, aislada de las demás.
- **Guardas** de autenticación y autorización.
- **El contrato de `AuthProvider`**, contra el adaptador real y contra el falso.

---

## Decisiones que merecen explicación

**`synchronize` es `false` y seguirá siéndolo.** La sincronización automática de
TypeORM no sabe expresar una columna generada ni una restricción `EXCLUDE`, y
las borraría sin avisar. El esquema es de las migraciones.

**Las migraciones no corren al arrancar.** `migrationsRun` está en `false` en
las dos fuentes de datos y existe un ejecutable aparte
(`node dist/database/run-migrations.js`). Si corrieran al arrancar, cada réplica
competiría por alterar el mismo esquema en cada despliegue, y una migración
fallida se convertiría en un bucle de reinicios en vez de en un paso fallido.

**El `Idempotency-Key` es del cliente, no del servidor.** Respaldado por un
índice único parcial sobre `(user_id, idempotency_key)`, parcial para que las
muchas filas sin clave no choquen entre sí. Un doble clic es un reintento, y
devuelve la reserva que ya se creó en lugar de un 409.

**Los errores siguen RFC 7807.** `application/problem+json` con el
`x-request-id` incluido, así que un error que reporta un usuario se puede
encontrar en los logs.

**La zona horaria vive en el recurso.** Los horarios operativos son hora local
(«de 9 a 18 los laborables») mientras que los instantes se guardan en UTC.
Guardar la zona en el recurso es lo que hace que esa frase signifique lo mismo a
los dos lados de un cambio de horario de verano.

---

## Cadena de suministro

Un `npm install` descuidado es hoy el vector más probable de compromiso, así que
hay medidas concretas:

- **`ignore-scripts=true`** en `.npmrc`. Ningún `postinstall` se ejecuta al
  instalar: es el vector número uno de los gusanos de npm.
- **`min-release-age=7`**. Una versión publicada hace menos de una semana no
  entra. La mayoría de los paquetes comprometidos se detectan y retiran en
  horas.
- **Versiones exactas**, sin `^` ni `~`, y `npm ci` en todas partes.
- **`make audit`** comprueba vulnerabilidades conocidas, firmas del registro y
  la base de datos de OSV.dev.
- **Acciones de GitHub fijadas por SHA**, no por etiqueta: una etiqueta se puede
  repuntar, un SHA no.
- La imagen de producción es multi-etapa, corre como `node` (no root), con
  sistema de ficheros de sólo lectura, sin capacidades y con `tini` como PID 1.

Estado actual: **0 vulnerabilidades**.

---

## Versionado

Commits convencionales validados por commitlint, `CHANGELOG.md` generado a
partir de ellos y versionado semántico:

```bash
make release
```

El changelog no se edita a mano. Si una entrada está mal redactada, el problema
está en el mensaje del commit.

---

## Documentación

- [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) — el plan
  completo, con las decisiones de diseño y un apéndice de tropiezos operativos
  encontrados durante la implementación.
- [http://localhost:3000/docs](http://localhost:3000/docs) — Swagger.
