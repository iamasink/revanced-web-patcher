# # Use the official Alpine image from the Docker Hub
# FROM alpine:3.14 AS builder

# # Install bash and curl
# RUN apk add --no-cache bash curl

# # Define variables
# ARG REVANCED_CLI_VER="4.6.0"
# ARG REVANCED_CLI_FILE="revanced-cli-${REVANCED_CLI_VER}-all.jar"

# # Retrieve the latest release
# RUN wget "https://github.com/ReVanced/revanced-cli/releases/download/v${REVANCED_CLI_VER}/${REVANCED_CLI_FILE}" - /revanced-cli.jar

# # Copy the entrypoint script into the image
# COPY ./src/entrypoint.sh /entrypoint.sh
# RUN chmod +x /entrypoint.sh

# # Set the entrypoint
# ENTRYPOINT ["/entrypoint.sh"]


# Stage 1: Install dependencies
FROM node:lts-iron AS dependencies

# Set the working directory
WORKDIR /usr/src/app

# Copy only package.json and package-lock.json (if available)
COPY package*.json ./

# download revanced-cli and patches
ARG REVANCED_CLI_VER="4.6.0"
ARG REVANCED_CLI_FILE="revanced-cli-${REVANCED_CLI_VER}-all.jar"
RUN wget -O /revanced-cli.jar "https://github.com/ReVanced/revanced-cli/releases/download/v${REVANCED_CLI_VER}/${REVANCED_CLI_FILE}"

ARG REVANCED_PATCHES_VER="4.8.3"
ARG REVANCED_PATCHES_FILE="revanced-patches-${REVANCED_PATCHES_VER}.jar"
ARG REVANCED_PATCHES_URL="https://github.com/ReVanced/revanced-patches/releases/download/v${REVANCED_PATCHES_VER}/${REVANCED_PATCHES_FILE}"
RUN wget -O /revanced-patches.jar ${REVANCED_PATCHES_URL}

ARG REVANCED_INTEGRATIONS_VER="1.9.2"
ARG REVANCED_INTEGRATIONS_FILE="revanced-integrations-${REVANCED_INTEGRATIONS_VER}.apk"
ARG REVANCED_INTEGRATIONS_URL="https://github.com/ReVanced/revanced-integrations/releases/download/v${REVANCED_INTEGRATIONS_VER}/${REVANCED_INTEGRATIONS_FILE}"
RUN wget -O /revanced-integrations.apk ${REVANCED_INTEGRATIONS_URL}

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install

# Stage 2: Compile TypeScript code
FROM dependencies AS builder

# Copy the source code
COPY src ./src
COPY tsconfig.json ./

# Compile TypeScript code
RUN npm run build

# Stage 3: Install OpenJDK JRE 11
FROM adoptopenjdk:11-jre-hotspot AS jre
# Define variables

# Stage 4: Create the production image
FROM node:lts-iron AS prod

# Set the working directory
WORKDIR /usr/src/app

# Copy the node_modules directory from the dependencies stage
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
# Copy revanced-cli, revances-patches, etc from dependencies
COPY --from=dependencies /revanced-* /

# Copy the compiled application code
COPY --from=builder /usr/src/app/dist ./dist
COPY src/public ./dist/public


# Copy JRE from the jre stage
COPY --from=jre /opt/java/openjdk /opt/java/openjdk

# Set environment variables for Java
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH=$PATH:$JAVA_HOME/bin

ENV NODE_ENV=prod

# Start the app
CMD ["node", "dist/index.js"]