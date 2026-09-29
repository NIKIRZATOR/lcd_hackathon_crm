COMPOSE = docker compose
DEMO_COMPOSE = $(COMPOSE) -f docker-compose.yml -f docker-compose.demo.yml --profile demo

.PHONY: dev demo scale backup backup-schedule backup-postgres backup-minio backup-keycloak restore-postgres restore-minio restore-keycloak backup-test load-test

dev:
	$(COMPOSE) up --build

demo:
	VITE_API_URL=http://localhost:8088 $(DEMO_COMPOSE) up --build --force-recreate --scale backend=$${BACKEND_REPLICAS:-3}

scale:
	VITE_API_URL=http://localhost:8088 $(DEMO_COMPOSE) up --build --force-recreate --scale backend=$${BACKEND_REPLICAS:-3}

backup:
	$(COMPOSE) --profile backup run --rm backup all

backup-schedule:
	$(COMPOSE) up backup-scheduler

backup-postgres:
	$(COMPOSE) --profile backup run --rm backup postgres

backup-minio:
	$(COMPOSE) --profile backup run --rm backup minio

backup-keycloak:
	$(COMPOSE) --profile backup run --rm backup keycloak

restore-postgres:
	$(COMPOSE) --profile backup run --rm backup restore-postgres "$(BACKUP)"

restore-minio:
	$(COMPOSE) --profile backup run --rm backup restore-minio "$(BACKUP)"

restore-keycloak:
	@echo "Keycloak imports must be performed with Keycloak stopped; see docs/infrastructure/restore.md."

backup-test:
	$(COMPOSE) --profile backup run --rm backup verify

load-test:
	@echo "See docs/infrastructure/load-testing.md for the explicit k6 command."
