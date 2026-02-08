FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-optional

COPY . .

# Build dashboard React app
RUN cd dashboard && npm ci && npm run build

EXPOSE 3000

CMD ["npm", "start"]
