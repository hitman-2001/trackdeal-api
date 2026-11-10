FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install system dependencies, extract Chrome for Puppeteer, and install node dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates unzip \
    && mkdir -p "$PUPPETEER_CACHE_DIR" /app/uploads \
    && npm ci --omit=dev \
    && rm -rf "$PUPPETEER_CACHE_DIR"/* \
    && PUPPETEER_SKIP_DOWNLOAD=false npx puppeteer browsers install chrome --install-deps \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/* \
    && chown -R node:node /app /home/node

# Copy the rest of the application files
COPY --chown=node:node . .

# Local storage remains writable when STORAGE_DRIVER=local.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Expose the API port
EXPOSE 3000

# Drop root privileges for the runtime process.
USER node

CMD ["npm", "start"]
