import qrcode
from pathlib import Path
import argparse

DEFAULT_BASE = "http://localhost:8080/"  # default; override with --base
PIECES = [f"piece_{i}" for i in range(1, 8)]


def make_qr(data: str, out: Path):
    img = qrcode.make(data)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    print("Saved:", out)


def main():
    parser = argparse.ArgumentParser(description="Generate QR PNGs for tangram pieces.")
    parser.add_argument("--base", default=DEFAULT_BASE, help="Base URL, e.g. http://127.0.0.1:5501/index.html")
    parser.add_argument("--name", default=None, help="Optional subfolder name under qrs/ for outputs")
    args = parser.parse_args()

    base = args.base.rstrip("?")
    # Ensure base doesn't end with extraneous trailing slash before ?piece
    # We'll just append '?piece=...'

    outdir = Path(__file__).parent
    if args.name:
        outdir = outdir / args.name

    urls = []
    for pid in PIECES:
        url = f"{base}?piece={pid}"
        urls.append(url)
        make_qr(url, outdir / f"{pid}.png")

    # Also generate a combined sheet for convenience
    try:
        from PIL import Image, ImageDraw
        imgs = [Image.open(outdir / f"{pid}.png").convert("RGB") for pid in PIECES]
        w, h = imgs[0].size
        cols = 4
        rows = 2
        margin = 20
        sheet_w = cols * w + (cols + 1) * margin
        sheet_h = rows * h + (rows + 1) * margin + 60
        sheet = Image.new("RGB", (sheet_w, sheet_h), "white")

        draw = ImageDraw.Draw(sheet)
        title = f"Tangram QR Codes\nBase: {base}"
        draw.text((margin, 10), title, fill=(0, 0, 0))

        for idx, (pid, img) in enumerate(zip(PIECES, imgs)):
            r = idx // cols
            c = idx % cols
            x = margin + c * (w + margin)
            y = 50 + margin + r * (h + margin)
            sheet.paste(img, (x, y))
            draw.text((x, y + h + 5), pid, fill=(0, 0, 0))

        out_sheet = outdir / "qr_sheet.png"
        out_sheet.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(out_sheet)
        print("Saved:", out_sheet)
    except Exception as e:
        print("Could not create sheet:", e)

    # Write a text file with the URLs for convenience
    urls_txt = outdir / "urls.txt"
    urls_txt.write_text("\n".join(urls), encoding="utf-8")
    print("Saved:", urls_txt)


if __name__ == "__main__":
    main()
