FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-optional

COPY . .

# Build all dashboard React apps
RUN cd dashboard-analytics && npm ci && npm run build
RUN cd dashboard-404check && npm ci && npm run build
RUN cd dashboard-growth && npm ci && npm run build
RUN cd dashboard-email && npm ci && npm run build
RUN cd dashboard-costs && npm ci && npm run build

EXPOSE 3000

CMD ["npm", "start"]
