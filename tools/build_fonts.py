#!/usr/bin/env python3
"""Rebuild the checked-in, renamed OFL font subsets used by the exhibition.

Install in a disposable virtualenv: pip install 'fonttools[woff]==4.68.0'
Run: python tools/build_fonts.py [--source-dir /path/to/cached/otf/files]
Normal npm builds use the committed WOFF2 files and do not need Python/network.
"""

import argparse
import hashlib
import tempfile
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
SERIF_REV = "7889f11bf31170b5d092a083b357c8c8130f89e0"
SANS_REV = "a4f7cf94edfb9d7ffbdfc4841de276358bd7e0f2"
FONTS = [
    ("serif-semibold", "March Serif", "SemiBold", "source-han-serif", SERIF_REV,
     "SourceHanSerifSC-SemiBold", "faf16caeaf207e1926e01af8d9f1a8e71b0e9d8f51bf3b5d9a78f9f30e7e3e31"),
    ("sans-regular", "March Sans", "Regular", "source-han-sans", SANS_REV,
     "SourceHanSansSC-Regular", "f1d8611151880c6c336aabeac4640ef434fa13cbfbf1ffe82d0a71b2a5637256"),
    ("sans-medium", "March Sans", "Medium", "source-han-sans", SANS_REV,
     "SourceHanSansSC-Medium", "1df61d31687d04fd2f928a3bb6ca6cd61f0e988cc267cf317f32406edbb49f70"),
]


def project_characters():
    paths = [ROOT / "index.html"]
    paths += sorted(p for p in (ROOT / "src").rglob("*") if p.suffix in {".vue", ".js", ".css"})
    # ASCII includes digits for counters. Additional live answers use system fallbacks.
    text = "".join(chr(i) for i in range(32, 127))
    text += "".join(p.read_text(encoding="utf-8-sig") for p in paths)
    return {ord(c) for c in text if c.isprintable()}


def rename(font, family, style):
    """The upstream OFL reserves 'Source'; derivative family names must change."""
    full_name = f"{family} {style}"
    ps_name = f"{family.replace(' ', '')}-{style}"
    names = {1: family, 2: style, 3: f"{ps_name};ExhibitionSubset1", 4: full_name,
             6: ps_name, 16: family, 17: style, 18: full_name, 21: family, 22: style}
    for record in font["name"].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    if "CFF " in font:
        cff = font["CFF "].cff
        cff.fontNames = [ps_name]
        top = cff.topDictIndex[0]
        top.FamilyName = family
        top.FullName = full_name
        if hasattr(top, "FDArray"):
            for index, fd in enumerate(top.FDArray):
                fd.FontName = f"{ps_name}-FD{index}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path)
    args = parser.parse_args()
    output = ROOT / "src/assets/fonts"
    output.mkdir(parents=True, exist_ok=True)
    characters = project_characters()
    with tempfile.TemporaryDirectory(prefix="long-march-fonts-") as temp:
        source_dir = args.source_dir or Path(temp)
        for key, family, style, repo, revision, original_name, digest in FONTS:
            source = source_dir / f"{key}.otf"
            if not source.exists():
                source.parent.mkdir(parents=True, exist_ok=True)
                url = f"https://raw.githubusercontent.com/adobe-fonts/{repo}/{revision}/OTF/SimplifiedChinese/{original_name}.otf"
                urllib.request.urlretrieve(url, source)
            if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
                raise ValueError(f"Unexpected source hash: {source}")
            font = TTFont(source, recalcTimestamp=False)
            rename(font, family, style)
            options = subset.Options()
            options.name_IDs = ["*"]  # Preserve copyright and OFL notices.
            options.name_languages = ["*"]
            # The site uses horizontal Simplified Chinese, so vertical and other
            # locale alternates need not be bundled alongside every character.
            options.layout_features = ["kern", "liga", "clig", "ccmp"]
            options.desubroutinize = True
            subsetter = subset.Subsetter(options=options)
            subsetter.populate(unicodes=characters)
            subsetter.subset(font)
            font.flavor = "woff2"
            target = output / f"march-{key}.woff2"
            font.save(target)
            print(f"{target.relative_to(ROOT)}: {target.stat().st_size:,} bytes; {len(font.getBestCmap())} characters")


if __name__ == "__main__":
    main()
