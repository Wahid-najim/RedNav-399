"""Local pattern finder: feature co-occurrence across the archive.

Label: "pattern-finder (local implementation, inspired by the co-occurrence
idea behind PathCORE-T)" -- NEVER "PathCore".

What PathCORE-T actually is (verified 2026-11-11, see
docs/VERIFICATION_LOG.md): Chen et al. 2018, BioData Mining 11:14,
doi:10.1186/s13040-018-0175-7 -- a transcriptomics method that finds
pathways co-occurring in gene-expression features more often than expected
by chance (greenelab/PathCORE-T). It is NOT an image tool and NOT a Mars
tool. Pathcore.io is a separate digital-pathology company. Neither was
installed. This module reuses only the *idea* -- count co-occurrences,
compare with the expected frequency under independence, list the pairs
that occur more than expected, each with n and the baseline -- implemented
here locally, in a few lines, over the archive's feature tags.
"""
from itertools import combinations


LABEL = "pattern-finder (local implementation, inspired by the co-occurrence idea behind PathCORE-T)"


def find_patterns(entries: list[dict]) -> dict:
    """entries: archive features, each with a 'properties' list of tags.

    Returns pairs occurring more than expected under independence, with
    count, expected count, n (archive size) and the baseline.
    """
    n = len(entries)
    if n == 0:
        return {"pairs": [], "label": LABEL, "n": 0, "note": "Archive is empty; no pairs can be computed."}
    counts: dict[str, int] = {}
    pair_counts: dict[tuple[str, str], int] = {}
    for e in entries:
        tags = sorted(set(e.get("properties") or []))
        for t in tags:
            counts[t] = counts.get(t, 0) + 1
        for a, b in combinations(tags, 2):
            pair_counts[(a, b)] = pair_counts.get((a, b), 0) + 1
    pairs = []
    for (a, b), c in sorted(pair_counts.items(), key=lambda kv: (-kv[1], kv[0])):
        expected = counts[a] * counts[b] / n
        if c > expected:
            pairs.append({
                "a": a, "b": b, "count": c,
                "expected": round(expected, 2),
                "note": (f"'{a}' (n={counts[a]}) and '{b}' (n={counts[b]}) co-occur in "
                         f"{c} of {n} archive entries; {expected:.2f} expected under "
                         f"independence. More than expected -- a pattern for the scientist to judge, not a finding."),
            })
    return {"pairs": pairs, "label": LABEL, "n": n,
            "note": (f"Co-occurrence over {n} archive entries. Expected counts assume "
                     "independence. A pair above its baseline is a prompt for the scientist, not evidence of a geological link.")}
