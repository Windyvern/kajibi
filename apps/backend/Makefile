ifneq (,$(wildcard ./.env))
    include .env
endif

SHELL := /bin/sh

DOCKERFILE ?= ./Dockerfile
REPOSITORY ?= reidaa
TARGET := scrapi
DOCKERTAG ?= latest

ENV_FILE_PATH := `realpath .env`

docker-build:
	docker build -f $(DOCKERFILE) -t $(REPOSITORY)/$(TARGET):$(DOCKERTAG) .

# docker-run: docker-build
# 	docker run --rm -P --env-file ${ENV_FILE_PATH} $(REPOSITORY)/$(TARGET):$(DOCKERTAG)  

docker-run: docker-build
	docker run --rm -P \
		-e HOST=$(HOST) \
		-e PORT=$(PORT) \
		-e APP_KEYS=$(APP_KEYS) \
		-e API_TOKEN_SALT=$(API_TOKEN_SALT) \
		-e ADMIN_JWT_SECRET=$(ADMIN_JWT_SECRET) \
		-e TRANSFER_TOKEN_SALT=$(TRANSFER_TOKEN_SALT) \
		-e DATABASE_CLIENT=$(DATABASE_CLIENT) \
		-e DATABASE_HOST=$(DATABASE_HOST) \
		-e DATABASE_PORT=$(DATABASE_PORT) \
		-e DATABASE_NAME=$(DATABASE_NAME) \
		-e DATABASE_USERNAME=$(DATABASE_USERNAME) \
                -e DATABASE_PASSWORD=$(DATABASE_PASSWORD) \
                -e DATABASE_SSL=$(DATABASE_SSL) \
                -e DATABASE_FILENAME=$(DATABASE_FILENAME) \
                -e JWT_SECRET=$(JWT_SECRET) \
                -e FRONTEND_URL=$(FRONTEND_URL) \
                $(REPOSITORY)/$(TARGET):$(DOCKERTAG)

deploy:
	ansible-playbook deployments/ansible/deploy.yml -vv 