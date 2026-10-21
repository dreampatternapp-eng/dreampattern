"""Renders faceless 9:16 short videos (TikTok, Reels, Shorts) for DreamPattern.

Usage: python3 marketing/videos/render.py OUT_DIR [slug ...]
Each video is a few text slides with cross-fades and no audio, so a trending
sound can be added in the app when posting. Captions go to OUT_DIR/captions.md.
"""
import json
import random
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
W, H = 1080, 1920
BG_TOP, BG_BOTTOM = (14, 11, 31), (34, 24, 72)
TEXT, DIM, GOLD = (242, 238, 255), (169, 162, 201), (242, 198, 109)
BOLD = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
MEDIUM = "/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf"
HOLD, FADE = 3.4, 0.5
TAGS = "#dreams #dreammeaning #dreaminterpretation #dreamjournal #dreamsymbols"

symbols = json.loads((ROOT / "marketing/dictionary/symbols.json").read_text())
hooks = json.loads((HERE / "hooks.json").read_text())


def background(seed):
    rnd = random.Random(seed)
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)))
    glow = Image.new("RGB", (W, H))
    ImageDraw.Draw(glow).ellipse([W * 0.15, H * 0.25, W * 0.85, H * 0.65], fill=(70, 50, 140))
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(220)), 0.35)
    d = ImageDraw.Draw(img)
    for _ in range(140):
        x, y, r = rnd.uniform(0, W), rnd.uniform(0, H), rnd.choice([1, 1, 1.5, 2, 2.5])
        c = rnd.randint(150, 255)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(c, c, min(255, c + 20)))
    return img


def wrap(draw, text, font, width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=font) <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


def slide(bg, kicker, text, size=76, icon=False, footer=None):
    img = bg.copy()
    d = ImageDraw.Draw(img)
    body = ImageFont.truetype(BOLD, size)
    small = ImageFont.truetype(MEDIUM, 44)
    lines = wrap(d, text, body, W - 220)
    lh = int(size * 1.25)
    block = lh * len(lines) + (90 if kicker else 0) + (300 if icon else 0)
    y = (H - block) // 2 - 80  # sit a little high: the bottom of the screen is covered by app UI
    if icon:
        ic = Image.open(ROOT / "site/icon.png").convert("RGBA").resize((240, 240))
        mask = Image.new("L", ic.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, 240, 240], 54, fill=255)
        img.paste(ic, ((W - 240) // 2, y), mask)
        y += 300
    if kicker:
        d.text((W / 2, y), kicker.upper(), font=small, fill=GOLD, anchor="mt")
        y += 90
    for ln in lines:
        d.text((W / 2, y), ln, font=body, fill=TEXT, anchor="mt")
        y += lh
    if footer:
        d.text((W / 2, y + 40), footer, font=small, fill=GOLD if icon else DIM, anchor="mt")
    return img


def cta(bg):
    return slide(bg, None, "Speak your dream when you wake. See what keeps coming back.", 64, icon=True,
                 footer="DreamPattern · search it on the App Store")


def videos():
    for s in symbols:
        yield {
            "slug": s["slug"],
            "lead": "Here's what it can mean",
            "slides": [("Dream meaning", hooks[s["slug"]], 92)]
            + [(t, d, 64) for t, d in s["themes"][:3]],
            "caption": f"{hooks[s['slug']]} Here's what people often connect it with. "
                       f"Which one fits your dream? 👇 More in our dream dictionary: dreampattern.app/dreams/{s['slug']} {TAGS}",
        }
    for v in hooks["_general"]:
        yield {
            "slug": v["slug"],
            "slides": [(v["kicker"], v["hook"], 92)] + [(k, t, 64) for k, t in v["points"]],
            "caption": f"{v['caption']} {TAGS}",
        }


def render(v, out, tmp):
    bg = background(v["slug"])
    frames = [slide(bg, k, t, sz, footer=v.get("lead") if i == 0 else None)
              for i, (k, t, sz) in enumerate(v["slides"])] + [cta(bg)]
    paths = []
    for i, f in enumerate(frames):
        p = tmp / f"{v['slug']}-{i}.png"
        f.save(p)
        paths.append(p)
    args = ["ffmpeg", "-y", "-loglevel", "error"]
    for p in paths:
        args += ["-loop", "1", "-t", str(HOLD + FADE), "-i", str(p)]
    chain, last = [], "0:v"
    for i in range(1, len(paths)):
        off = i * HOLD
        chain.append(f"[{last}][{i}:v]xfade=transition=fade:duration={FADE}:offset={off:.2f}[v{i}]")
        last = f"v{i}"
    args += ["-filter_complex", ";".join(chain), "-map", f"[{last}]", "-r", "30",
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart",
             str(out / f"{v['slug']}.mp4")]
    subprocess.run(args, check=True)
    frames[0].save(out / f"{v['slug']}-cover.jpg", quality=90)


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[2:])
    caps = []
    with tempfile.TemporaryDirectory() as tmp:
        for n, v in enumerate(videos(), 1):
            caps.append(f"## {n}. {v['slug']}.mp4\n\n{v['caption']}\n")
            if only and v["slug"] not in only:
                continue
            render(v, out, Path(tmp))
            print("rendered", v["slug"])
    (out / "captions.md").write_text("# Video captions\n\nPaste the caption, add a trending sound in the app, then post.\n\n" + "\n".join(caps))


if __name__ == "__main__":
    main()
