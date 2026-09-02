# Reservations API -- development and operations entry point.
#
# The contract of this file: someone who has just cloned the repository and has
# nothing but Docker installed can run `make` and end up with a working API,
# a migrated database and demo data to sign in with. No Node on the host, no
# .env to write, no order to remember.
#
# Everything runs inside containers, so the result does not depend on which
# Node version happens to be on the machine.

SHELL := /bin/sh
.DEFAULT_GOAL := help

COMPOSE      := docker compose
COMPOSE_PROD := docker compose -f docker-compose.prod.yml
API          := $(COMPOSE) exec -T api
PSQL         := $(COMPOSE) exec -T postgres psql -U reservations -d reservations

# Every target is a verb, not a file. Without this, a target named `test`
# would be skipped whenever a directory called `test` exists -- which it does.
.PHONY: help up down start stop restart logs logs-api shell psql adminer \
        migrate migrate-revert migrate-status seed reset db-reset \
        test test-watch test-cov test-e2e verify-overlap verify-concurrency \
        lint format typecheck check audit openapi build prod-up prod-down \
        release clean

# -----------------------------------------------------------------------------
# Getting started
# -----------------------------------------------------------------------------

help: ## Muestra esta ayuda
	@echo "Reservations API"
	@echo ""
	@echo "Primer arranque:  make start"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

start: up migrate seed ## Arranque completo desde cero: contenedores, esquema y datos de demo
	@echo ""
	@echo "  API      http://localhost:3000"
	@echo "  Swagger  http://localhost:3000/docs"
	@echo "  Adminer  http://localhost:8080"
	@echo ""
	@echo "  Entra con admin@reservas.dev / Reservas2026!"

up: ## Levanta los contenedores y espera a que la API responda
	$(COMPOSE) up -d --build
	@echo "Esperando a la API..."
	@$(COMPOSE) exec -T api sh -c 'i=0; while [ $$i -lt 60 ]; do \
		wget -q -O /dev/null http://127.0.0.1:3000/health 2>/dev/null && exit 0; \
		i=$$((i+1)); sleep 2; done; \
		echo "La API no respondió en 120s. Revisa: make logs-api"; exit 1'
	@echo "API lista."

down: ## Para los contenedores y borra los volúmenes (se pierden los datos)
	$(COMPOSE) down -v

stop: ## Para los contenedores conservando los datos
	$(COMPOSE) stop

restart: stop up ## Reinicia sin perder datos

# -----------------------------------------------------------------------------
# Database
# -----------------------------------------------------------------------------

migrate: ## Aplica las migraciones pendientes
	$(API) npm run migration:run:dev

migrate-revert: ## Revierte la última migración
	$(API) npm run migration:revert:dev

migrate-status: ## Muestra qué migraciones están aplicadas
	$(API) npm run migration:show:dev

seed: ## Carga usuarios, recursos y reservas de demostración (idempotente)
	$(API) npm run seed:dev

db-reset: ## Vacía el esquema y lo reconstruye desde cero
	$(PSQL) -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
	@$(MAKE) migrate seed

reset: down start ## Borra todo y vuelve a empezar

psql: ## Abre una consola psql
	$(COMPOSE) exec postgres psql -U reservations -d reservations

adminer: ## Recuerda dónde está Adminer
	@echo "http://localhost:8080  (servidor: postgres, usuario/clave: reservations)"

# -----------------------------------------------------------------------------
# Tests
# -----------------------------------------------------------------------------

test: ## Tests unitarios
	$(API) npm test

test-watch: ## Tests unitarios en modo watch
	$(COMPOSE) exec api npm run test:watch

test-cov: ## Tests unitarios con cobertura
	$(API) npm run test:cov

test-e2e: ## Tests end-to-end (levantan su propio PostgreSQL con Testcontainers)
	$(API) npm run test:e2e

verify-overlap: ## Demuestra la restricción de solapamiento por SQL, sin pasar por la API
	@# El fichero se envía por stdin: vive en este repositorio, no dentro del
	@# contenedor de PostgreSQL. Y se ejecuta contra la base de datos directamente,
	@# saltándose la API a propósito: si la garantía dependiera del código de
	@# aplicación, esta prueba no demostraría nada.
	$(PSQL) -v ON_ERROR_STOP=0 < scripts/verify-overlap-constraint.sql
	@echo ""
	@echo "Nota: los ERROR de exclusion_violation son el resultado esperado."

verify-concurrency: ## Lanza 25 reservas simultáneas: debe ganar exactamente una
	$(API) node scripts/concurrency-check.mjs

# -----------------------------------------------------------------------------
# Code quality
# -----------------------------------------------------------------------------

lint: ## ESLint con --fix
	$(API) npm run lint

format: ## Prettier
	$(API) npm run format

typecheck: ## Comprobación de tipos sin emitir
	$(API) npm run typecheck

check: typecheck lint test ## Todo lo que valida CI antes de un commit

audit: ## Vulnerabilidades conocidas y firmas del registro
	$(API) npm run audit:vulns
	$(API) npm run audit:signatures
	$(API) npm run audit:osv

# -----------------------------------------------------------------------------
# Miscellaneous
# -----------------------------------------------------------------------------

logs: ## Sigue los logs de todos los servicios
	$(COMPOSE) logs -f

logs-api: ## Sigue los logs de la API
	$(COMPOSE) logs -f api

shell: ## Abre una shell dentro del contenedor de la API
	$(COMPOSE) exec api sh

openapi: ## Regenera openapi.json (lo consume el frontend con `make api-types`)
	$(API) npm run openapi:generate

build: ## Construye la imagen de producción
	docker build -t reservations-api:local .

prod-up: ## Levanta la composición de producción (requiere secrets/ y variables)
	$(COMPOSE_PROD) up -d

prod-down: ## Para la composición de producción
	$(COMPOSE_PROD) down

release: ## Corta una versión: CHANGELOG, bump y tag
	npm run release

clean: down ## Para todo y borra artefactos de compilación
	rm -rf dist coverage tsconfig.build.tsbuildinfo
