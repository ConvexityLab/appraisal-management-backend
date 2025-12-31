# Azure Functions Node.js container image for the appraisal functions workload
FROM mcr.microsoft.com/azure-functions/node:4-node20 AS base

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

WORKDIR /home/site/wwwroot

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy function source, bindings, and templates
COPY . .

# Remove any local settings file that might have been copied accidentally
RUN if [ -f "local.settings.json" ]; then rm local.settings.json; fi

# Default entrypoint is already defined in the base image to start the Functions host
