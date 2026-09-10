FROM node:latest

RUN npm install --global tiddlywiki

COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /var/lib/tiddlywiki

EXPOSE 1112

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
