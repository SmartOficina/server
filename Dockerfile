# Imagem base com Node.js
FROM node:20.19.0-alpine

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de package
COPY package*.json ./

# Instala as dependências
RUN npm ci

# Copia o restante do código da aplicação
COPY . .

# Exponha a porta que sua aplicação utiliza (ex: 3000)
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"]