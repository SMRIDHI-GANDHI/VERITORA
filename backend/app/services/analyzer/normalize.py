from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


@dataclass
class NormalizedText:
    original: str
    normalized: str
    # for each index in normalized, index in original
    norm_to_orig: list[int]


_ws_re = re.compile(r"\s+")


def normalize_with_offsets(text: str) -> NormalizedText:
    # Build normalized stream with mapping to original indices.
    chars: list[str] = []
    mapping: list[int] = []
    for i, ch in enumerate(text):
        for out in unicodedata.normalize("NFKC", ch).lower():
            if out.isspace():
                out = " "
            chars.append(out)
            mapping.append(i)
    # collapse whitespace runs to single space, keep mapping to first char in run
    collapsed_chars: list[str] = []
    collapsed_map: list[int] = []
    prev_space = False
    for c, oi in zip(chars, mapping, strict=False):
        if c == " ":
            if not prev_space:
                collapsed_chars.append(" ")
                collapsed_map.append(oi)
            prev_space = True
        else:
            collapsed_chars.append(c)
            collapsed_map.append(oi)
            prev_space = False
    normalized = "".join(collapsed_chars).strip()
    # adjust mapping for strip
    if not collapsed_chars:
        return NormalizedText(original=text, normalized="", norm_to_orig=[])
    start = 0
    end = len(collapsed_chars)
    while start < end and collapsed_chars[start] == " ":
        start += 1
    while end > start and collapsed_chars[end - 1] == " ":
        end -= 1
    return NormalizedText(
        original=text,
        normalized=normalized,
        norm_to_orig=collapsed_map[start:end],
    )


def span_to_original(norm_text: NormalizedText, start: int, end: int) -> tuple[int, int] | None:
    if start < 0 or end <= start or end > len(norm_text.norm_to_orig):
        return None
    orig_start = norm_text.norm_to_orig[start]
    orig_end_char = norm_text.norm_to_orig[end - 1]
    return (orig_start, orig_end_char + 1)
