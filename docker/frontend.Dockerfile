# Frontend Dockerfile (frontend.Dockerfile)
FROM node:16

WORKDIR /app

# Install dependencies
COPY package.json .
COPY package-lock.json .
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Expose the frontend port
EXPOSE 5173

# Start the Vite server
CMD ["npm", "run", "dev"]
