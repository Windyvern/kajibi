# Creating multi-stage build for production
FROM node:20-alpine AS build
# Prereqs for building native modules like sharp on Alpine (musl)
# - build-base/gcc/make for compilation
# - python3 for node-gyp
# - vips-dev headers for sharp
RUN apk update && apk add --no-cache \
    build-base \
    gcc \
    autoconf \
    automake \
    zlib-dev \
    libpng-dev \
    vips-dev \
    git \
    python3 > /dev/null 2>&1
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ARG FRONTEND_URL
ENV FRONTEND_URL=${FRONTEND_URL}
ENV PATH=/opt/node_modules/.bin:$PATH

WORKDIR /opt/
COPY package.json package-lock.json ./
# Ensure node-gyp present and allow longer fetch timeouts for prebuilt binaries
RUN npm install -g node-gyp \
 && npm config set fetch-retry-maxtimeout 600000 -g \
 # Install with dev deps so `strapi develop` works when mounted in compose
 && npm ci \
 # Ensure sharp native binding is built for alpine/musl
 && npm rebuild sharp --verbose
WORKDIR /opt/app
COPY . .
RUN npm run build

# Creating final production image
FROM node:20-alpine
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ARG FRONTEND_URL
ENV FRONTEND_URL=${FRONTEND_URL}
ENV PATH=/opt/node_modules/.bin:$PATH

RUN apk add --no-cache vips-dev ffmpeg unzip \
 && (apk add --no-cache exiftool || apk add --no-cache perl-image-exiftool || true)
WORKDIR /opt/
COPY --from=build /opt/node_modules ./node_modules
WORKDIR /opt/app
COPY --from=build /opt/app ./
# Ensure app paths exist and are writable by node user, including bind/volume mount targets
RUN mkdir -p /opt/app/node_modules/.strapi \
 && chown -R node:node /opt/app /opt/node_modules
USER node
EXPOSE 1337
ENTRYPOINT ["npm", "run"]
CMD [ "start" ]
