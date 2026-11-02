"""Download the DeepFace emotion weights at build time.

v1's image shipped with /root/.deepface/weights/ empty because its startup warmup
raised on the missing haarcascade before it ever reached the model download.
"""
import numpy as np
from deepface import DeepFace

DeepFace.analyze(
    np.zeros((48, 48, 3), dtype=np.uint8),
    actions=["emotion"],
    enforce_detection=False,
    detector_backend="opencv",
    silent=True,
)
print("weights warmed")
