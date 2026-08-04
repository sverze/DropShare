FROM node:22-alpine AS frontend-dependencies
WORKDIR /opt/app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

FROM node:22-alpine AS frontend-builder
ARG NEXT_PUBLIC_DROPSHARE_URL=http://localhost:3000
ARG NEXT_PUBLIC_AUTH_URL=http://localhost:3000
ENV NEXT_PUBLIC_DROPSHARE_URL=$NEXT_PUBLIC_DROPSHARE_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
WORKDIR /opt/app
COPY ./frontend .
COPY --from=frontend-dependencies /opt/app/node_modules ./node_modules
RUN npm run build

FROM node:22-alpine AS backend-dependencies
RUN apk add --no-cache python3
WORKDIR /opt/app
COPY backend/package.json backend/package-lock.json ./
RUN npm install

FROM node:22-alpine AS backend-builder
RUN apk add openssl

WORKDIR /opt/app
COPY ./backend .
COPY --from=backend-dependencies /opt/app/node_modules ./node_modules
RUN npx prisma@5.22.0 generate
RUN npm run build && npm prune --production

FROM node:22-alpine AS runner
ENV NODE_ENV=production

# Default database location. Both halves of the app have to agree on this: the
# Prisma CLI reads it from the environment when the entrypoint runs migrations,
# and PrismaService falls back to the same value in backend/src/constants.ts.
# Without it the CLI picks up backend/prisma/.env instead and the two end up on
# different files. Overridden by anything set in .env or compose.
ENV DATABASE_URL=file:../data/dropshare.db?connection_limit=1

RUN deluser --remove-home node

RUN apk update --no-cache \
    && apk upgrade --no-cache \
    && apk add --no-cache \
       curl \
       caddy \
       su-exec \
       openssl \
       ffmpeg \
       flac \
       p7zip \
       unzip \
       zip \
       ghostscript \
       qpdf \
       poppler-utils \
       imagemagick \
       libheif-tools \
       nodejs \
       fontconfig \
       ttf-dejavu \
    && mkdir -p /var/cache/fontconfig /.cache/fontconfig /.fontconfig \
    && chmod -R 777 /var/cache/fontconfig /.cache/fontconfig /.fontconfig \
    && fc-cache -f

WORKDIR /opt/app/frontend
COPY --from=frontend-builder /opt/app/public ./public
COPY --from=frontend-builder /opt/app/.next/standalone ./
COPY --from=frontend-builder /opt/app/.next/static ./.next/static
COPY --from=frontend-builder /opt/app/public/img /tmp/img

WORKDIR /opt/app/backend
COPY --from=backend-builder /opt/app/node_modules ./node_modules
COPY --from=backend-builder /opt/app/dist ./dist
COPY --from=backend-builder /opt/app/prisma ./prisma
COPY --from=backend-builder /opt/app/package.json ./
COPY --from=backend-builder /opt/app/tsconfig.json ./

RUN chmod -R 755 ./prisma

WORKDIR /opt/app

COPY ./reverse-proxy  /opt/app/reverse-proxy
COPY ./scripts/docker ./scripts/docker

COPY ./LICENSE /opt/app/LICENSE

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s CMD /bin/sh -c '(if [[ "$CADDY_DISABLED" = "true" ]]; then curl -fs http://localhost:${BACKEND_PORT:-8080}/api/health; else curl -fs http://localhost:3000/api/health; fi) || exit 1'

ENTRYPOINT ["sh", "./scripts/docker/create-user.sh"]
CMD ["sh", "./scripts/docker/entrypoint.sh"]
