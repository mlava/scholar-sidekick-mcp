# Sandboxed run for the Scholar Sidekick MCP server.
#
# The server speaks MCP over stdio and needs outbound HTTPS to the Scholar Sidekick API —
# nothing else. Running it in a container keeps it off the host filesystem entirely.
#
#   docker build -t scholar-sidekick-mcp .
#   docker run -i --rm --read-only --cap-drop ALL --security-opt no-new-privileges \
#     scholar-sidekick-mcp
#
# See README.md § Run in a container for the MCP client config.

FROM node:20-alpine AS build
WORKDIR /build
# Install from the lockfile so the build is reproducible.
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build

FROM node:20-alpine
LABEL org.opencontainers.image.title="scholar-sidekick-mcp" \
      org.opencontainers.image.description="MCP server for Scholar Sidekick — citation verification, retraction and open-access checks, 10,000+ CSL styles." \
      org.opencontainers.image.source="https://github.com/mlava/scholar-sidekick-mcp" \
      org.opencontainers.image.url="https://scholar-sidekick.com/mcp" \
      org.opencontainers.image.licenses="MIT"

# esbuild bundles every dependency into the one output file, so the runtime image needs no
# node_modules — nothing to install, nothing to keep patched.
COPY --from=build /build/dist/mcp-server.mjs /app/dist/mcp-server.mjs

USER node
ENTRYPOINT ["node", "/app/dist/mcp-server.mjs"]
