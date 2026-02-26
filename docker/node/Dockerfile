FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pm2@latest

WORKDIR /home/node/app

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY ecosystem.config.cjs /home/node/ecosystem.config.cjs
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["entrypoint.sh"]
CMD ["pm2-runtime", "/home/node/ecosystem.config.cjs"]
