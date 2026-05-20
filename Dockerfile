# Use a lightweight Node.js image
FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Build the application using our defined scripts
RUN npm run build

# Expose the application port
EXPOSE 3000

# Start the compiled server
CMD ["npm", "start"]
