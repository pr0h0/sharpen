FROM oven/bun:1.3 AS build
WORKDIR /app
COPY . .
RUN bash tools/build.sh

FROM python:3.12-slim
WORKDIR /app
COPY tools/serve.py tools/serve.py
COPY --from=build /app/dist dist
ENV SHARPEN_DB=/data/sharpen.db SHARPEN_TRUST_CF=1
VOLUME /data
EXPOSE 4956
CMD ["python3", "-u", "tools/serve.py", "4956", "0.0.0.0"]
