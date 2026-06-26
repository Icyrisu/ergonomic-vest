FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Expose Vite's default port
EXPOSE 5173

# Run Vite dev server, bound to 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host"]
