# Global scope: Workspace
ARG WORKSPACE=packages/admin

# Stage 1: Dependencies
FROM node:lts-alpine AS deps
WORKDIR /app

# Note: Declaring it without a value makes it inherit the global ARG on top
ARG WORKSPACE

COPY package*.json ./

# Sadly, we still need to copy the other workspace's package.json even if we shouldn't needed, due to the NPM limitations discussed below (see "NOTES" comment, point 2). If we made the switch to pnpm for example, we could avoid all these manual copies of individual workspaces.
COPY packages/core/package*.json ./packages/core/
COPY packages/web/package*.json ./packages/web/
COPY packages/admin/package*.json ./packages/admin/

# NOTES:
# 1. In the build stage we get all dependencies, including devDependencies, since devDependencies are needed for the build step (e.g. TypeScript, bundlers, etc.)
# 2. Due to limitations in how npm handles workspaces, we need to run npm ci at the root level, not just in the workspace folder, to ensure all dependencies are correctly installed and linked. If we ever want to move to a more efficient approach, we could consider switch to pnpm, which supports this use case much better with "pnpm --filter=<workspace> deploy".
RUN npm ci

# Stage 2: Builder
FROM node:lts-alpine AS builder
WORKDIR /app

# Note: Declaring it without a value makes it inherit the global ARG on top
ARG WORKSPACE

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -w ${WORKSPACE}

# Stage 3: Runner (Node.js backend)
FROM node:lts-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Note: Declaring it without a value makes it inherit the global ARG on top
ARG WORKSPACE

COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY ${WORKSPACE}/package*.json ./${WORKSPACE}/

RUN npm ci --omit=dev -w ${WORKSPACE}
COPY --from=builder /app/${WORKSPACE}/dist ./${WORKSPACE}/dist

EXPOSE 3000
ENV PORT=3000

CMD sh -c "npm run start -w ${WORKSPACE}"