# Node-versjonen pinnes her, ikke på verten.
#
# Det er hele grunnen til at dette kjøres i container: appen bestemmer selv
# hvilken Node den trenger, og en oppgradering av verten kan ikke velte den.
FROM node:22-alpine

# Byggeinformasjon settes av deploy-skriptet, og vises på /versjon. Da ser du
# at en utrulling faktisk traff, i stedet for å håpe.
ARG VERSJON=ukjent
ARG BYGGET=ukjent
ENV VERSJON=$VERSJON BYGGET=$BYGGET

# Kjør som ikke-privilegert bruker. node-brukeren finnes i grunnimaget.
WORKDIR /app
COPY package.json ./
COPY src ./src

# Datakatalogen monteres som volum, men må finnes og eies riktig.
RUN mkdir -p /data && chown -R node:node /app /data
USER node

ENV PORT=8080 DATAKATALOG=/data
EXPOSE 8080

# Docker trenger å vite forskjell på «kjører» og «svarer».
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/helse').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/tjener.mjs"]
