"""RAG store: MongoDB-backed document store + sentence-transformer embeddings.

Uses brute-force cosine similarity in numpy so it works on a free MongoDB
Atlas M0 cluster with zero index setup. Fine for demo-scale corpora
(hundreds–low thousands of chunks). Swap to Atlas Vector Search later if needed.
"""
import os
import numpy as np
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer

_model = None


def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2"))
    return _model


class RagStore:
    def __init__(self):
        uri = os.getenv("MONGO_URI")
        if not uri:
            raise RuntimeError("MONGO_URI not set")
        self.client = MongoClient(uri)
        db = self.client[os.getenv("MONGO_DB", "voicesync")]
        self.col = db[os.getenv("MONGO_COLLECTION", "documents")]

    def add(self, text, source="manual"):
        """Embed and store one document chunk."""
        emb = get_model().encode(text).tolist()
        self.col.insert_one({"text": text, "source": source, "embedding": emb})

    def add_many(self, chunks, source="upload"):
        model = get_model()
        embs = model.encode(chunks)
        docs = [
            {"text": c, "source": source, "embedding": e.tolist()}
            for c, e in zip(chunks, embs)
        ]
        if docs:
            self.col.insert_many(docs)
        return len(docs)

    def search(self, query, k=4):
        """Return top-k most similar chunks via cosine similarity."""
        docs = list(self.col.find({}, {"text": 1, "embedding": 1, "source": 1}))
        if not docs:
            return []
        q = np.array(get_model().encode(query), dtype=np.float32)
        mat = np.array([d["embedding"] for d in docs], dtype=np.float32)
        # cosine sim
        sims = mat @ q / (np.linalg.norm(mat, axis=1) * np.linalg.norm(q) + 1e-9)
        idx = np.argsort(-sims)[:k]
        return [
            {"text": docs[i]["text"], "source": docs[i].get("source"), "score": float(sims[i])}
            for i in idx
        ]

    def count(self):
        return self.col.count_documents({})
