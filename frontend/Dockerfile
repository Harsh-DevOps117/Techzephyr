FROM node:latest AS build
WORKDIR /app
ARG API_INTERNAL_URL=http://api:3000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:latest
WORKDIR /app
ENV NODE_ENV=production
ENV API_INTERNAL_URL=http://api:3000
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3001
ENV PORT=3001
CMD ["node", "server.js"]
