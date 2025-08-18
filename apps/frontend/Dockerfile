# Multi-stage Dockerfile for frontend

# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Inject Vite build-time variables so the browser uses correct endpoints
ARG VITE_API_BASE
ARG VITE_STRAPI_URL
ENV VITE_API_BASE=${VITE_API_BASE}
ENV VITE_STRAPI_URL=${VITE_STRAPI_URL}
RUN npm run build

# Run stage
FROM node:20-alpine AS run
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
