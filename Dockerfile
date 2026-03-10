FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

ENV NODE_ENV=production
ENV PORT=4637

EXPOSE 4637

CMD ["sh", "-c", "npm run build && node dist/index.cjs"]
