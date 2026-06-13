FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies (including devDependencies for nodemon)
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the API port
EXPOSE 3000

# Start the application in development mode with nodemon
CMD ["npm", "run", "dev"]
