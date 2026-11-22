from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def render_block(page, name, content):
    opening = f"<!-- shared:{name} -->"
    closing = f"<!-- /shared:{name} -->"
    before, block = page.split(opening, 1)
    _, after = block.split(closing, 1)
    return f"{before}{opening}\n{content.strip()}\n{closing}{after}"


for filename in ("index.html", "catalog.html"):
    path = ROOT / "dist" / filename
    page = path.read_text(encoding="utf-8")
    for name in ("header", "header-icons", "header-dialogs", "price-dialog"):
        content = (ROOT / "templates" / f"{name}.html").read_text(encoding="utf-8")
        content = content.replace("{{contacts}}", "#contacts" if filename == "index.html" else "./index.html#contacts")
        page = render_block(page, name, content)
    path.write_text(page, encoding="utf-8")
