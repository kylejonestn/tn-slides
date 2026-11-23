#!/usr/bin/env python3
"""
Inspect an existing .pptx file for:
1. Slide text & speaker notes
2. Logical shape reading order (p:spTree order)
3. Images missing WCAG 2.1 alt text (descr attribute on p:cNvPr)

Zero external dependencies (Python 3 stdlib only).
"""

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

GENERIC_NAME_RE = re.compile(r"^(?:picture|image|img|graphic|photo|chart)\s*\d*$|^.*\.(?:png|jpe?g|gif|webp|svg)$", re.I)


def extract_text_from_elem(elem):
    texts = []
    for p in elem.findall(".//a:p", NS):
        runs = [t.text for t in p.findall(".//a:t", NS) if t.text]
        line = "".join(runs).strip()
        if line:
            texts.append(line)
    return texts


def parse_rels(zf, rels_path):
    rels = {}
    if rels_path not in zf.namelist():
        return rels
    root = ET.fromstring(zf.read(rels_path))
    for rel in root:
        rid = rel.attrib.get("Id", "")
        target = rel.attrib.get("Target", "")
        rtype = rel.attrib.get("Type", "")
        rels[rid] = {"target": target, "type": rtype}
    return rels


def inspect_pptx(pptx_path):
    report = {
        "file": pptx_path,
        "slideCount": 0,
        "missingAltCount": 0,
        "slides": [],
    }

    with zipfile.ZipFile(pptx_path, "r") as zf:
        slide_files = [
            name for name in zf.namelist()
            if re.match(r"^ppt/slides/slide\d+\.xml$", name)
        ]
        slide_files.sort(key=lambda s: int(re.search(r"slide(\d+)\.xml$", s).group(1)))
        report["slideCount"] = len(slide_files)

        for idx, slide_path in enumerate(slide_files, start=1):
            slide_num = int(re.search(r"slide(\d+)\.xml$", slide_path).group(1))
            rels_path = f"ppt/slides/_rels/slide{slide_num}.xml.rels"
            rels = parse_rels(zf, rels_path)

            root = ET.fromstring(zf.read(slide_path))
            sp_tree = root.find(".//p:cSld/p:spTree", NS)

            reading_order = []
            images = []

            if sp_tree is not None:
                order_idx = 0
                for child in sp_tree:
                    tag = child.tag.split("}")[-1]
                    if tag in ("sp", "pic", "graphicFrame", "grpSp"):
                        order_idx += 1
                        c_nv_pr = child.find(".//p:cNvPr", NS)
                        shape_name = c_nv_pr.attrib.get("name", "") if c_nv_pr is not None else ""
                        descr = (c_nv_pr.attrib.get("descr", "") if c_nv_pr is not None else "").strip()

                        if tag == "pic":
                            blip = child.find(".//a:blip", NS)
                            embed_rid = blip.attrib.get(f"{{{NS['r']}}}embed", "") if blip is not None else ""
                            media_target = rels.get(embed_rid, {}).get("target", "")
                            is_missing_alt = (not descr) or bool(GENERIC_NAME_RE.match(descr))
                            if is_missing_alt:
                                report["missingAltCount"] += 1
                            img_info = {
                                "order": order_idx,
                                "name": shape_name,
                                "media": media_target,
                                "altText": descr,
                                "needsAltText": is_missing_alt,
                            }
                            images.append(img_info)
                            reading_order.append({"order": order_idx, "type": "image", "name": shape_name, "altText": descr})
                        else:
                            lines = extract_text_from_elem(child)
                            if lines:
                                reading_order.append({"order": order_idx, "type": tag, "name": shape_name, "text": lines})

            # Extract speaker notes if linked
            notes_text = ""
            for rel in rels.values():
                if "notesSlide" in rel.get("type", ""):
                    target = rel["target"].replace("../", "ppt/")
                    if target in zf.namelist():
                        notes_root = ET.fromstring(zf.read(target))
                        notes_lines = extract_text_from_elem(notes_root)
                        notes_text = "\n".join(notes_lines)
                    break

            report["slides"].append({
                "slideNumber": idx,
                "readingOrder": reading_order,
                "images": images,
                "notes": notes_text,
            })

    return report


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 inspect_pptx.py <file.pptx> [--json]", file=sys.stderr)
        sys.exit(1)

    pptx_path = sys.argv[1]
    as_json = "--json" in sys.argv
    report = inspect_pptx(pptx_path)

    if as_json:
        print(json.dumps(report, indent=2))
        return

    print(f"PPTX Inspection: {report['file']} ({report['slideCount']} slides)")
    print(f"Images missing WCAG 2.1 alt text: {report['missingAltCount']}\n")
    for s in report["slides"]:
        print(f"--- Slide {s['slideNumber']} ---")
        for item in s["readingOrder"]:
            if item["type"] == "image":
                status = "OK" if item["altText"] else "MISSING ALT"
                print(f"  [{item['order']}] IMAGE ({item['name']}): [{status}] alt=\"{item['altText']}\"")
            else:
                preview = " | ".join(item["text"])[:100]
                print(f"  [{item['order']}] {item['type'].upper()}: {preview}")
        if s["images"]:
            for img in s["images"]:
                if img["needsAltText"]:
                    print(f"  -> ACTION NEEDED: Ask user for alt text for '{img['name']}' ({img['media']})")
        if s["notes"]:
            print(f"  Notes: {s['notes'][:100]}")


if __name__ == "__main__":
    main()
