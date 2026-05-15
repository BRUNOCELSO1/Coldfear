FROM python:3.11-slim

WORKDIR /app
COPY . /app

RUN chmod +x /app/docker-entrypoint.sh

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

CMD ["/app/docker-entrypoint.sh"]
