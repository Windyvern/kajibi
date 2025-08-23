FROM nginx:1.27-alpine

# Remove default config and add our own
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/site.conf

# .htpasswd is mounted at runtime to /etc/nginx/.htpasswd
EXPOSE 80

CMD ["nginx","-g","daemon off;"]

