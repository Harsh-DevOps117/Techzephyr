# syntax=docker/dockerfile:1
FROM node:latest AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
# In managed environments, pass the proxy CA with:
# docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" .
RUN --mount=type=secret,id=proxy_ca,required=false \
    sh -c 'if [ -s /run/secrets/proxy_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --strict-ssl=true; else npm ci --strict-ssl=true; fi'

FROM dependencies AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:latest AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --strict-ssl=true
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY validator.py ./validator.py
COPY docs ./docs
COPY data ./data
EXPOSE 3000
CMD ["node", "dist/server.js"]
