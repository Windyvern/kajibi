# Creating multi-stage build for production
FROM node:20-alpine AS build
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git > /dev/null 2>&1
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ARG FRONTEND_URL
ENV FRONTEND_URL=${FRONTEND_URL}
ENV PATH=/opt/node_modules/.bin:$PATH

WORKDIR /opt/
COPY package.json package-lock.json ./
RUN npm install -g node-gyp
RUN npm config set fetch-retry-maxtimeout 600000 -g && npm install --omit=dev
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

RUN apk add --no-cache vips-dev
WORKDIR /opt/
COPY --from=build /opt/node_modules ./node_modules
WORKDIR /opt/app
COPY --from=build /opt/app ./
RUN chown -R node:node /opt/app
USER node
EXPOSE 1337
ENTRYPOINT ["npm", "run"]
CMD [ "start" ]
