FROM python:3.11-slim
WORKDIR /app

# System libs needed by opencv-python (pulled in by deepface)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libxcb1 \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip/setuptools to avoid source-build failures
RUN pip install --upgrade pip setuptools wheel

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    # deepface pulls opencv-python (non-headless); force headless back on top
    && pip install --no-cache-dir --force-reinstall opencv-python-headless

COPY . .
EXPOSE 8003
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
