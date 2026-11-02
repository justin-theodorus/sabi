# Layers a working OpenCV onto the already-built v1 image rather than rebuilding it.
# v1's Dockerfile ends with an unpinned `--force-reinstall opencv-python-headless`,
# which resolved to 5.0.0. That release ships cv2/data/ containing only __init__.py,
# so the haarcascade DeepFace's opencv detector_backend looks for does not exist and
# every analyze call raised. 4.10.0.84 still ships the cascades.
FROM sabi-expression-service:latest

RUN pip install --no-cache-dir --force-reinstall opencv-python-headless==4.10.0.84

# Assert the cascade is actually present before baking the image.
RUN python -c "import cv2, os; p = os.path.join(os.path.dirname(cv2.data.__file__), 'haarcascade_frontalface_default.xml'); assert os.path.exists(p), 'cascade still missing: ' + p; print('cascade ok:', cv2.__version__)"

# Pull the emotion weights at build time so first-call download is not measured as latency.
# /root/.deepface/weights/ was empty in the v1 image: the model was never downloaded.
COPY warm_weights.py /tmp/warm_weights.py
RUN python /tmp/warm_weights.py && rm /tmp/warm_weights.py
