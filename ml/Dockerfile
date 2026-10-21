FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TOKENIZERS_PARALLELISM=false \
    HF_HOME=/app/.hf-cache

RUN useradd -m -u 1000 user
WORKDIR /app

RUN pip install --index-url https://download.pytorch.org/whl/cpu torch
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY artifacts ./artifacts
RUN python -m app.prefetch && chown -R user:user /app

USER user
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.server:app --host 0.0.0.0 --port ${PORT:-7860}"]
