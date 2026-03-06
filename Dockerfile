# Build stage for firmware
FROM python:3.9-slim AS firmware-builder

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN pip install -U platformio pillow

WORKDIR /app
COPY platformio.ini .
COPY boards/ ./boards/
COPY src/ ./src/
COPY icons-buttons/ ./icons-buttons/
COPY icons-ui/ ./icons-ui/
COPY generate-icons.py .

# Pre-fetch dependencies
RUN pio pkg install

# Command to build firmware
CMD ["pio", "run"]

# Development stage for Next.js
FROM node:22-bullseye AS web-dev

WORKDIR /app/web

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y libc6 build-essential python3 && rm -rf /var/lib/apt/lists/*

# Optimize for caching
COPY web/package*.json ./
RUN npm install

# Copy source
COPY web/ ./

EXPOSE 3000

# Next.js 15+ needs this for some Docker environments
ENV NEXT_TELEMETRY_DISABLED 1

CMD ["npm", "run", "dev"]
