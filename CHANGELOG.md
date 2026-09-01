# Changelog

Todas las versiones de este proyecto se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el versionado sigue [Semantic Versioning](https://semver.org/lang/es/).

> Fichero generado por `commit-and-tag-version` a partir de los mensajes de
> commit. **No se edita a mano**: si una entrada está mal redactada, el problema
> está en el mensaje del commit.
>
> Cortar una versión: `npm run release` (o el workflow _Release_ en GitHub).

## 0.1.0 (2026-09-01)

### Funcionalidades

- **auth:** add guards, decorators and secure-by-default registration 3e1c7a7
- **auth:** add the Better Auth adapter and a fake provider 440e522
- **auth:** configure Better Auth behind a lazy ESM bridge 5d4ba6a
- **auth:** define the AuthProvider port with a contract test db8c2c1
- bootstrap the application module and HTTP server 7bbf456
- **common:** add RFC 7807 error handling and shared utilities 8056623
- **common:** add the shared pagination DTOs f57a461
- **config:** expose the OpenAPI document via Swagger 9554755
- **config:** validate the environment at boot with zod ea0e661
- **database:** add the TypeORM data source and test harness 7fb10ef
- **database:** create the identity schema 66f64f4
- **database:** create the required PostgreSQL extensions 2036bf0
- **database:** create the resource catalogue schema 77c6bbe
- **database:** enforce non-overlapping reservations in PostgreSQL cc8f880
- **health:** add a liveness and readiness endpoint a83de54
- **resources:** add the catalogue entities and domain errors de9470d
- **resources:** add the catalogue repositories 64c3d25
- **resources:** add the resource catalogue CRUD 0a7b280
- **resources:** validate resource attributes against their type's schema 2707916

### Correcciones

- **build:** declare types explicitly and keep tsBuildInfo inside dist 7961b2f
- **database:** add the account.issuer column required by better-auth 1.7 ab9582a
- **docker:** mount the TypeScript config into the dev container 3d7f1a1
- **health:** expose the health endpoint publicly b1b69f6
- restore JSON body parsing outside the auth routes dcb6a72

### Documentación

- add the implementation plan abcd224

### Build y dependencias

- **docker:** add development and production images with PostgreSQL 18 c27fef2
