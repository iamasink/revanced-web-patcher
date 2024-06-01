ARG REVANCED_CLI_VER="4.6.0"
ARG REVANCED_PATCHES_VER="4.8.3"
ARG REVANCED_INTEGRATIONS_VER="1.9.2"



# Stage 1: Install dependencies
FROM node:lts-iron AS dependencies

# download revanced-cli and patches
ARG REVANCED_CLI_VER
ARG REVANCED_CLI_FILE="revanced-cli-${REVANCED_CLI_VER}-all.jar"
RUN wget -O /revanced-cli.jar "https://github.com/ReVanced/revanced-cli/releases/download/v${REVANCED_CLI_VER}/${REVANCED_CLI_FILE}"

ARG REVANCED_PATCHES_VER
ARG REVANCED_PATCHES_FILE="revanced-patches-${REVANCED_PATCHES_VER}.jar"
ARG REVANCED_PATCHES_URL="https://github.com/ReVanced/revanced-patches/releases/download/v${REVANCED_PATCHES_VER}/${REVANCED_PATCHES_FILE}"
ARG REVANCED_PATCHES_JSON_URL="https://github.com/ReVanced/revanced-patches/releases/download/v${REVANCED_PATCHES_VER}/patches.json"
RUN wget -O /revanced-patches.jar ${REVANCED_PATCHES_URL}
RUN wget -O /patches.json ${REVANCED_PATCHES_JSON_URL}

ARG REVANCED_INTEGRATIONS_VER
ARG REVANCED_INTEGRATIONS_FILE="revanced-integrations-${REVANCED_INTEGRATIONS_VER}.apk"
ARG REVANCED_INTEGRATIONS_URL="https://github.com/ReVanced/revanced-integrations/releases/download/v${REVANCED_INTEGRATIONS_VER}/${REVANCED_INTEGRATIONS_FILE}"
RUN wget -O /revanced-integrations.apk ${REVANCED_INTEGRATIONS_URL}

# Set the working directory
WORKDIR /usr/src/app

# Copy only package.json and package-lock.json (if available)
COPY package*.json ./

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

# Stage 3: Install OpenJDK JRE 11 https://hub.docker.com/_/eclipse-temurin/
FROM eclipse-temurin:11 AS jre-build
# Create a custom Java runtime
RUN $JAVA_HOME/bin/jlink \
    --add-modules java.base,java.logging,java.desktop \
    --strip-debug \
    --no-man-pages \
    --no-header-files \
    --compress=2 \
    --output /javaruntime

# Stage 4: Create the production image
FROM node:lts-iron AS prod
ARG REVANCED_CLI_VER
ARG REVANCED_PATCHES_VER
ARG REVANCED_INTEGRATIONS_VER

# Set the working directory
WORKDIR /usr/src/app

# Copy the node_modules directory from the dependencies stage
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
# Copy revanced-cli, revances-patches, etc from dependencies
COPY --from=dependencies /revanced-* /
COPY --from=dependencies /patches.json /

# Copy the compiled application code
COPY --from=builder /usr/src/app/dist ./dist
COPY src/public/ ./dist/public
# remove .ts files so the browser doesnt whine
# RUN find /usr/src/app -type f -name '*.ts' -delete
# RUN find /usr/src/app -type f -name '*.map' -delete

# # Copy JRE from the jre stage
# COPY --from=jre /opt/java/openjdk /opt/java/openjdk

# # Set environment variables for Java
# ENV JAVA_HOME=/opt/java/openjdk
# ENV PATH=$PATH:$JAVA_HOME/bin

ENV JAVA_HOME=/opt/java/openjdk
ENV PATH "${JAVA_HOME}/bin:${PATH}"
COPY --from=jre-build /javaruntime $JAVA_HOME

ENV NODE_ENV=prod
ENV CLIVERSION=${REVANCED_CLI_VER}
ENV PATCHESVERSION=${REVANCED_PATCHES_VER}
ENV INTEGRATIONSVERSION=${REVANCED_INTEGRATIONS_VER}


# Start the app
CMD ["node", "dist/index.js"]