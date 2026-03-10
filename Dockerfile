FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 4637

ENV NODE_ENV=production
ENV PORT=4637

CMD ["node", "dist/index.cjs"]
