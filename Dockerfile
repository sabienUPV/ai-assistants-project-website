# Etapa 1: Construcción
FROM node:lts-alpine AS build
WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el resto del código y construir el sitio
COPY . .
RUN npm run build

# Etapa 2: Servidor de producción
FROM nginx:stable-alpine

# Copiar los archivos estáticos desde la etapa de construcción
# Por defecto, Astro los guarda en /dist
COPY --from=build /app/dist /usr/share/nginx/html

# Exponer el puerto 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]