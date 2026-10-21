from .config import load_settings
from .encoder import SentenceEncoder
from .index import VectorIndex

index = VectorIndex.load(load_settings().artifacts_dir)
SentenceEncoder.from_name(index.model_name)
print("model ready:", index.model_name)
