FROM node:16.14.2-alpine3.15 as base
WORKDIR /app
RUN mkdir -p dist node_modules .yarn-cache && chown -R node:node .

FROM base as build
ARG API_HOST
ARG REALM_HOST
ARG PORT=3000
ARG SERVICE_NAME=uploader
ARG ROLLBAR_POST_SERVER_TOKEN
ARG I18N_ENABLED=false
ARG RX_ENABLED=false
ARG PENDO_ENABLED=true
ARG TRAVIS_COMMIT
# Set ENV from ARGs
ENV \
    API_HOST=$API_HOST \
    REALM_HOST=$REALM_HOST \
    PORT=$PORT \
    SERVICE_NAME=$SERVICE_NAME \
    ROLLBAR_POST_SERVER_TOKEN=$ROLLBAR_POST_SERVER_TOKEN \
    I18N_ENABLED=$I18N_ENABLED \
    RX_ENABLED=$RX_ENABLED \
    PENDO_ENABLED=$PENDO_ENABLED \
    TRAVIS_COMMIT=$TRAVIS_COMMIT \
    NODE_ENV=development

# Install dependancies
RUN \
  echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories \
  && echo "http://dl-cdn.alpinelinux.org/alpine/edge/main" >> /etc/apk/repositories \
  && echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories \
  && apk --no-cache update \
  && apk --no-cache upgrade \
  && apk add --no-cache --virtual .build-deps alpine-sdk python3 linux-headers eudev-dev ffmpeg-dev \
  && rm -rf /var/cache/apk/* /tmp/*
USER node
RUN mkdir -p /home/node/.yarn-cache /home/node/.cache/yarn
COPY --chown=node:node package.json yarn.lock ./
RUN --mount=type=cache,target=/home/node/.yarn-cache,id=yarn,uid=1000,gid=1000 yarn install --ignore-scripts --cache-folder /home/node/.yarn-cache
# Copy source files, and possibily invalidate so we have to rebuild
COPY --chown=node:node . .
RUN npm run build-web
USER root
RUN apk del .build-deps

FROM base as production
ARG API_HOST
ARG REALM_HOST
ARG PORT=3000
ARG SERVICE_NAME=uploader
ARG ROLLBAR_POST_SERVER_TOKEN
ARG I18N_ENABLED=false
ARG RX_ENABLED=false
ARG PENDO_ENABLED=true
ARG TRAVIS_COMMIT
# Set ENV from ARGs
ENV \
    API_HOST=$API_HOST \
    REALM_HOST=$REALM_HOST \
    PORT=$PORT \
    SERVICE_NAME=$SERVICE_NAME \
    ROLLBAR_POST_SERVER_TOKEN=$ROLLBAR_POST_SERVER_TOKEN \
    I18N_ENABLED=$I18N_ENABLED \
    RX_ENABLED=$RX_ENABLED \
    PENDO_ENABLED=$PENDO_ENABLED \
    TRAVIS_COMMIT=$TRAVIS_COMMIT \
    NODE_ENV=production
# Only install dependancies needed for the production server
USER node
RUN yarn add express@4.16.3 helmet@7.0.0 body-parser@1.18.3
# Copy only files needed to run the server
COPY --from=build /app/dist dist
COPY --from=build \
    /app/config.server.js \
    /app/package.json \
    /app/server.js \
    ./
CMD ["npm", "run", "server"]
