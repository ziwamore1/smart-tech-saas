# Digital Signature Service — issuer UI (Next.js standalone)
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# API base is a browser-side var — baked as a build arg.
ARG NEXT_PUBLIC_DSIG_API_URL=http://localhost:4001
ENV NEXT_PUBLIC_DSIG_API_URL=$NEXT_PUBLIC_DSIG_API_URL

RUN npm run build

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
