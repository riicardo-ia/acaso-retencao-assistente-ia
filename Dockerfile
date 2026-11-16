# Uma imagem para os dois serviços (etl e app); o compose decide o comando e o que cada um enxerga.
FROM python:3.12.7-slim
WORKDIR /app
RUN useradd --system --uid 10001 bi
COPY etl/requirements.txt etl/requirements.txt
COPY app/requirements.txt app/requirements.txt
RUN pip install --no-cache-dir -r etl/requirements.txt -r app/requirements.txt
COPY analise/ analise/
COPY etl/ etl/
COPY app/ app/
COPY data/seed/ data/seed/
RUN mkdir -p data/raw data/tmp && chown -R bi data
USER 10001
