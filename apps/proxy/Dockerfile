FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Use npm install since no lockfile is committed
RUN npm install --omit=dev
COPY . .
EXPOSE 4000
CMD ["npm","start"]
