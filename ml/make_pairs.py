import argparse
import json
import re
from pathlib import Path

from retrieval_eval import DEFAULT_HANDBOOK, DEFAULT_QUESTIONS, ROOT, load_handbook, load_questions

OFFENSES = ROOT.parent / "public" / "assets" / "js" / "data" / "offenses.json"
OFFENSE_TEMPLATES = ["Is {t} an offense?", "What degree of offense is {t}?", "Does the code cover {t}?"]
SANCTION_TEMPLATES = ["What is the sanction for {t}?", "What is the penalty for {t}?", "What interventions apply to {t}?"]
SECTION_TEMPLATE = "What does the policy say about {t}?"


SECTION_RE = re.compile(r"^(First|Second|Third) Degree Offenses, no\. (\d+)$")


def lower_first(text):
    return text[:1].lower() + text[1:]


def offense_chunk(chunks, degree, number):
    """The chunk under '<DEGREE> OFFENSES' whose text has the numbered item `number`."""
    title = f"{degree} degree offenses".upper()
    pattern = re.compile(r"(^|\n)" + re.escape(str(number)) + r"\.\s")
    for chunk in chunks:
        if chunk.get("title", "").upper() == title and pattern.search(chunk["text"]):
            return chunk["id"]
    return None


def intervention_chunk(chunks, degree):
    """The chunk titled '<DEGREE> INTERVENTIONS' (found by title, so a re-chunk cannot leave a stale id)."""
    title = f"{degree} degree interventions".upper()
    return next((c["id"] for c in chunks if c.get("title", "").upper() == title), None)


def build_pairs(chunks, offenses, extra=()):
    pairs = []
    for off in offenses:
        m = SECTION_RE.match(off["section"].strip())
        offense_id = offense_chunk(chunks, m.group(1), m.group(2)) if m else None
        sanction_id = intervention_chunk(chunks, off["category"].split()[0])
        topic = lower_first(off["type"])
        if offense_id:
            pairs += [{"q": t.format(t=topic), "id": offense_id} for t in OFFENSE_TEMPLATES]
        if sanction_id:
            pairs += [{"q": t.format(t=topic), "id": sanction_id} for t in SANCTION_TEMPLATES]
    for chunk in chunks:
        title = re.sub(r"^\d+(\.\d+)*\s*", "", chunk.get("title", "")).strip().lower()
        if title:
            pairs.append({"q": SECTION_TEMPLATE.format(t=title), "id": chunk["id"]})
    pairs += list(extra)
    seen, unique = set(), []
    for p in pairs:
        key = (p["q"].strip().lower(), p["id"])
        if key not in seen:
            seen.add(key)
            unique.append(p)
    return unique


def without_eval_questions(pairs, questions):
    blocked = {q["q"].strip().lower() for q in questions}
    return [p for p in pairs if p["q"].strip().lower() not in blocked]


def main():
    parser = argparse.ArgumentParser(description="Build training pairs (question, chunk id) from the handbook and the offense catalog")
    parser.add_argument("--handbook", default=str(DEFAULT_HANDBOOK))
    parser.add_argument("--offenses", default=str(OFFENSES))
    parser.add_argument("--questions", default=str(DEFAULT_QUESTIONS))
    parser.add_argument("--extra", default=str(ROOT / "eval" / "train_extra.jsonl"))
    parser.add_argument("--out", default=str(ROOT / "eval" / "train_pairs.jsonl"))
    args = parser.parse_args()

    _, chunks = load_handbook(args.handbook)
    offenses = json.loads(Path(args.offenses).read_text(encoding="utf-8"))["offenses"]
    extra_path = Path(args.extra)
    extra = [json.loads(l) for l in extra_path.read_text(encoding="utf-8").splitlines() if l.strip()] if extra_path.exists() else []
    pairs = without_eval_questions(build_pairs(chunks, offenses, extra), load_questions(args.questions))
    Path(args.out).write_text("\n".join(json.dumps(p, ensure_ascii=False) for p in pairs) + "\n", encoding="utf-8")
    print(f"{len(pairs)} training pairs written to {args.out}")


if __name__ == "__main__":
    main()
