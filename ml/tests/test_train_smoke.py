import json
from types import SimpleNamespace

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("sentence_transformers")
transformers = pytest.importorskip("transformers")

WORDS = ["[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]", "vandalism", "smoking", "uniform", "appeal", "days", "penalty", "what", "is", "the", "for", "rule", "school", "student"]


def tiny_sentence_model(tmp_path):
    from sentence_transformers import SentenceTransformer, models
    from transformers import BertConfig, BertModel, BertTokenizerFast

    vocab = tmp_path / "vocab.txt"
    vocab.write_text("\n".join(WORDS), encoding="utf-8")
    tokenizer = BertTokenizerFast(vocab_file=str(vocab), do_lower_case=True)
    config = BertConfig(vocab_size=len(WORDS), hidden_size=16, num_hidden_layers=1, num_attention_heads=2, intermediate_size=32, max_position_embeddings=64)
    folder = tmp_path / "tiny-bert"
    BertModel(config).save_pretrained(folder)
    tokenizer.save_pretrained(folder)
    model = SentenceTransformer(modules=[models.Transformer(str(folder)), models.Pooling(16, "mean")])
    target = tmp_path / "tiny-st"
    model.save(str(target))
    return str(target)


def test_one_training_run_produces_a_saved_model_and_a_finite_loss(tmp_path):
    import train

    topics = ["vandalism", "smoking", "uniform", "appeal", "days", "penalty"]
    chunks = [{"id": f"C{i}", "title": f"{i} {t}", "text": f"the rule for {t} student school"} for i, t in enumerate(topics)]
    handbook = tmp_path / "handbook.json"
    handbook.write_text(json.dumps({"version": "t", "chunks": chunks}), encoding="utf-8")
    questions = tmp_path / "questions.jsonl"
    questions.write_text(
        "\n".join(json.dumps({"id": f"Q{i}", "kind": "in_scope", "split": "dev", "lang": "en", "q": f"what is the {t}", "gold": [f"C{i}"]}) for i, t in enumerate(topics)),
        encoding="utf-8",
    )
    pairs = tmp_path / "pairs.jsonl"
    pairs.write_text(
        "\n".join(json.dumps({"q": f"{w} for {t}", "id": f"C{i}"}) for i, t in enumerate(topics) for w in ("what is the rule", "the penalty")),
        encoding="utf-8",
    )
    out = tmp_path / "out"
    args = SimpleNamespace(
        model=tiny_sentence_model(tmp_path), pairs=str(pairs), handbook=str(handbook), questions=str(questions), out=str(out),
        epochs=2, batch_size=4, lr=1e-3, temperature=0.05, max_seq_length=32, seed=1,
    )
    log = train.train(args)
    assert len(log) == 3
    assert all(entry["loss"] is None or entry["loss"] == entry["loss"] for entry in log)
    assert (out / "train_log.json").exists()
    assert (out / "modules.json").exists()
