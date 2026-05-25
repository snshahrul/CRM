FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev && npm install pm2 -g

COPY backend/ ./
COPY index_CRM.html ../

ENV PORT=3000
ENV DB_PATH=/data/crm.db
ENV JWT_SECRET=change-this-to-a-random-string

RUN mkdir -p /data

EXPOSE 3000

CMD ["pm2-runtime", "server.js", "--name", "crm"]
