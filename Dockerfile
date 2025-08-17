# Use Node.js LTS
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and install deps
COPY package*.json ./
RUN npm install

# Copy app code
COPY . .

# Expose port
EXPOSE 5000

# Run the app
CMD ["npm", "run", "dev"]
