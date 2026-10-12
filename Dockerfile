FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@12.9.0 --activate
# Prisma's schema engine, which the release command runs, needs OpenSSL
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
# Installing runs `prisma generate`, which needs the schema and its config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
COPY app/env.server.ts ./app/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM base
ENV NODE_ENV=production PRISMA_HIDE_UPDATE_MESSAGE=1
COPY --from=build /app/package.json /app/prisma.config.ts /app/server.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/server ./server
COPY --from=build /app/prisma ./prisma
# The seed imports the server-only modules and the generated client
COPY --from=build /app/app ./app
CMD ["node", "server.ts"]
