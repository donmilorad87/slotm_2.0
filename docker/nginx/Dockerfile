FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

# Generate self-signed SSL certificate for dev
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 3650 \
      -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/selfsigned.key \
      -out /etc/nginx/ssl/selfsigned.crt \
      -subj "/C=US/ST=Dev/L=Local/O=slotm/CN=localhost"

COPY default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80 443
