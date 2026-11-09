# Imagem para rodar a Function localmente no docker-compose.
# No Azure ela roda num Function App (plano Consumo/Flex), publicada pelo CI.
FROM mcr.microsoft.com/azure-functions/node:4-node22

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    FUNCTIONS_WORKER_RUNTIME=node

WORKDIR /home/site/wwwroot
COPY package*.json ./
RUN npm ci --omit=dev
COPY host.json ./
COPY src ./src
