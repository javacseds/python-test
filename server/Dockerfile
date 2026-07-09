FROM python:3.10-alpine
RUN addgroup -S sandbox && adduser -S sandbox -G sandbox
USER sandbox
WORKDIR /app
CMD ["python"]
