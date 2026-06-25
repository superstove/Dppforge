"""
TDS-to-JSON Converter for Digital Product Passports
====================================================

Converts construction material Technical Data Sheets into structured
DPP JSON and generates QR codes pointing to ConstructAsk verification.

Workflow:
    Technical Data Sheet (PDF/manual)
        → Extract engineering parameters
        → Normalize units and values
        → Structure into DPP JSON schema
        → Generate QR code for verification
        → Ready for ConstructAsk integration

Usage:
    python tds_to_json_converter.py                  # interactive mode
    python tds_to_json_converter.py --demo           # generate demo products
    python tds_to_json_converter.py --list           # list existing DPP files
    python tds_to_json_converter.py --qr <file.json> # generate QR for a DPP file
    python tds_to_json_converter.py --validate <file> # validate against schema
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent
SCHEMA_FILE = OUTPUT_DIR / "dpp-schema.json"
VERIFY_BASE_URL = os.getenv("CONSTRUCTASK_VERIFY_URL", "https://constructask.vercel.app")


# ---------------------------------------------------------------------------
# Unit normalization
# ---------------------------------------------------------------------------

UNIT_MAP = {
    "kn/m": "kN/m",
    "kpa": "kPa",
    "mpa": "MPa",
    "mm": "mm",
    "m": "m",
    "cm": "cm",
    "kg": "kg",
    "g/m2": "g/m²",
    "g/m²": "g/m²",
    "g/cm3": "g/cm³",
    "g/cm³": "g/cm³",
    "kgco2e": "kgCO2e",
    "kgco2e/m2": "kgCO2e/m²",
    "kgco2e/m²": "kgCO2e/m²",
    "sqm": "m²",
    "sq.m": "m²",
    "sq m": "m²",
    "°c": "°C",
    "deg c": "°C",
    "celsius": "°C",
    "%": "%",
    "percent": "%",
    "hours": "hours",
    "hrs": "hours",
    "minutes": "minutes",
    "min": "minutes",
    "months": "months",
    "years": "years",
    "µm": "µm",
    "micron": "µm",
    "nm": "Nm",
    "litres": "litres",
    "liters": "litres",
    "l": "litres",
    "units": "units",
    "tonnes": "tonnes",
    "s-1": "s⁻¹",
    "s⁻¹": "s⁻¹",
    "m2/s": "m²/s",
    "m²/s": "m²/s",
    "ph": "pH",
}


def normalize_unit(raw: str) -> str:
    return UNIT_MAP.get(raw.lower().strip(), raw.strip())


def parse_numeric(value_str: str) -> int | float | str:
    value_str = value_str.strip()
    try:
        if "." in value_str:
            return float(value_str)
        return int(value_str)
    except ValueError:
        return value_str


# ---------------------------------------------------------------------------
# DPP JSON builder
# ---------------------------------------------------------------------------

def generate_passport_id(product_name: str, batch: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]", "-", product_name)
    slug = re.sub(r"-+", "-", slug).strip("-").upper()[:20]
    return f"DPP-{slug}-{date.today().year}"


def generate_qr_code(passport_id: str) -> str:
    return f"QR-{passport_id.replace('DPP-', '')}"


def build_property(value, unit: str, test_method: str | None = None) -> dict:
    prop = {"value": value, "unit": normalize_unit(unit)}
    if test_method:
        prop["test_method"] = test_method
    return prop


def build_dpp_json(
    product_name: str,
    manufacturer: str,
    category: str,
    description: str,
    technical_properties: dict,
    working_properties: dict,
    applications: list[str],
    suitable_for: list[str],
    standards: list[str],
    batch_number: str,
    production_date: str,
    origin_country: str,
    factory_location: str,
    recycled_content_pct: int = 0,
    carbon_footprint_value: float = 0.0,
    carbon_footprint_unit: str = "kgCO2e/unit",
    packaging: str = "",
    storage: str = "",
    shelf_life_months: int = 12,
    tds_title: str = "",
    tds_revision: str = "",
    tds_date: str = "",
) -> dict:
    passport_id = generate_passport_id(product_name, batch_number)
    qr_code = generate_qr_code(passport_id)

    return {
        "dpp_version": "1.0",
        "passport_id": passport_id,
        "product_name": product_name,
        "manufacturer": manufacturer,
        "category": category,
        "description": description,
        "technical_properties": technical_properties,
        "working_properties": working_properties,
        "application": {
            "primary_use": applications,
            "suitable_for": suitable_for,
        },
        "standards_compliance": standards,
        "packaging_and_storage": {
            "packaging": packaging,
            "storage": storage,
            "shelf_life": {
                "value": shelf_life_months,
                "unit": "months",
                "condition": "unopened, original packaging",
            },
        },
        "sustainability": {
            "recycled_content_pct": recycled_content_pct,
            "carbon_footprint": {
                "value": carbon_footprint_value,
                "unit": normalize_unit(carbon_footprint_unit),
            },
            "recyclable": True,
        },
        "batch_info": {
            "batch_number": batch_number,
            "production_date": production_date,
            "origin_country": origin_country,
            "factory_location": factory_location,
        },
        "qr_verification": {
            "qr_code": qr_code,
            "verification_url": f"{VERIFY_BASE_URL}/verify/{passport_id}",
            "scan_type": "check_specification",
        },
        "source_document": {
            "type": "Technical Data Sheet",
            "document_title": tds_title or f"{product_name} - Technical Data Sheet",
            "revision": tds_revision,
            "date_issued": tds_date,
            "conversion_method": "manual",
            "converted_by": "Abhijith",
            "conversion_date": str(date.today()),
        },
    }


# ---------------------------------------------------------------------------
# QR code generation
# ---------------------------------------------------------------------------

def generate_qr_image(passport_id: str, verification_url: str, output_path: Path) -> Path:
    try:
        import qrcode
    except ImportError:
        print("  [!] qrcode library not installed. Install with: pip install qrcode[pil]")
        print(f"  [i] QR URL: {verification_url}")
        return None

    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(verification_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    qr_dir = output_path.parent / "qr_codes"
    qr_dir.mkdir(exist_ok=True)
    qr_file = qr_dir / f"{passport_id}.png"
    img.save(str(qr_file))
    return qr_file


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_dpp_json(dpp: dict) -> list[str]:
    errors = []
    required_fields = [
        "dpp_version", "passport_id", "product_name", "manufacturer",
        "category", "technical_properties", "standards_compliance",
        "batch_info", "source_document",
    ]
    for field in required_fields:
        if field not in dpp:
            errors.append(f"Missing required field: {field}")

    if "passport_id" in dpp and not dpp["passport_id"].startswith("DPP-"):
        errors.append("passport_id must start with 'DPP-'")

    if "batch_info" in dpp:
        for sub in ["batch_number", "production_date", "origin_country"]:
            if sub not in dpp["batch_info"]:
                errors.append(f"Missing batch_info.{sub}")

    if "source_document" in dpp:
        for sub in ["type", "conversion_method", "converted_by", "conversion_date"]:
            if sub not in dpp["source_document"]:
                errors.append(f"Missing source_document.{sub}")

    if "standards_compliance" in dpp:
        if not isinstance(dpp["standards_compliance"], list) or len(dpp["standards_compliance"]) == 0:
            errors.append("standards_compliance must be a non-empty array")

    if "technical_properties" in dpp:
        if not isinstance(dpp["technical_properties"], dict) or len(dpp["technical_properties"]) == 0:
            errors.append("technical_properties must be a non-empty object")

    return errors


# ---------------------------------------------------------------------------
# Interactive mode
# ---------------------------------------------------------------------------

def prompt_input(label: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    val = input(f"  {label}{suffix}: ").strip()
    return val if val else default


def prompt_properties() -> dict:
    print("\n  Enter technical properties (empty name to stop):")
    props = {}
    while True:
        name = input("    Property name: ").strip()
        if not name:
            break
        key = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
        value = input("    Value: ").strip()
        unit = input("    Unit: ").strip()
        test_method = input("    Test method (optional): ").strip()
        props[key] = build_property(parse_numeric(value), unit, test_method or None)
    return props


def prompt_list(label: str) -> list[str]:
    print(f"\n  Enter {label} (empty line to stop):")
    items = []
    while True:
        item = input("    - ").strip()
        if not item:
            break
        items.append(item)
    return items


def interactive_convert():
    print("\n" + "=" * 60)
    print("  TDS → JSON Digital Product Passport Converter")
    print("=" * 60)
    print("\n  Enter product information from the Technical Data Sheet:\n")

    product_name = prompt_input("Product name")
    manufacturer = prompt_input("Manufacturer")
    category = prompt_input("Category (e.g. Geosynthetic Reinforcement)")
    description = prompt_input("Description")

    tech_props = prompt_properties()

    print("\n  Working / Installation Properties:")
    work_props = prompt_properties()

    applications = prompt_list("primary applications")
    suitable_for = prompt_list("suitable project types")
    standards = prompt_list("standards compliance (e.g. ISO 10319)")

    print("\n  Batch Information:")
    batch_number = prompt_input("Batch number")
    production_date = prompt_input("Production date (YYYY-MM-DD)", str(date.today()))
    origin_country = prompt_input("Origin country", "India")
    factory_location = prompt_input("Factory location")

    print("\n  Sustainability:")
    recycled_pct = int(prompt_input("Recycled content %", "0"))
    carbon_value = float(prompt_input("Carbon footprint value", "0"))
    carbon_unit = prompt_input("Carbon footprint unit", "kgCO2e/unit")

    print("\n  Packaging:")
    packaging = prompt_input("Packaging description")
    storage = prompt_input("Storage requirements")
    shelf_life = int(prompt_input("Shelf life (months)", "12"))

    print("\n  Source TDS Document:")
    tds_title = prompt_input("TDS document title", f"{product_name} - Technical Data Sheet")
    tds_revision = prompt_input("TDS revision", "Rev 1.0")
    tds_date = prompt_input("TDS date issued", "")

    dpp = build_dpp_json(
        product_name=product_name,
        manufacturer=manufacturer,
        category=category,
        description=description,
        technical_properties=tech_props,
        working_properties=work_props,
        applications=applications,
        suitable_for=suitable_for,
        standards=standards,
        batch_number=batch_number,
        production_date=production_date,
        origin_country=origin_country,
        factory_location=factory_location,
        recycled_content_pct=recycled_pct,
        carbon_footprint_value=carbon_value,
        carbon_footprint_unit=carbon_unit,
        packaging=packaging,
        storage=storage,
        shelf_life_months=shelf_life,
        tds_title=tds_title,
        tds_revision=tds_revision,
        tds_date=tds_date,
    )

    errors = validate_dpp_json(dpp)
    if errors:
        print("\n  [!] Validation warnings:")
        for e in errors:
            print(f"      - {e}")

    filename = re.sub(r"[^a-z0-9]+", "-", product_name.lower()).strip("-") + ".json"
    filepath = OUTPUT_DIR / filename
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(dpp, f, indent=2, ensure_ascii=False)
    print(f"\n  [OK] DPP JSON saved: {filepath}")

    qr_file = generate_qr_image(
        dpp["passport_id"],
        dpp["qr_verification"]["verification_url"],
        filepath,
    )
    if qr_file:
        print(f"  [OK] QR code saved: {qr_file}")

    print(f"\n  Passport ID:       {dpp['passport_id']}")
    print(f"  Verification URL:  {dpp['qr_verification']['verification_url']}")
    print(f"  QR Code ID:        {dpp['qr_verification']['qr_code']}")


# ---------------------------------------------------------------------------
# List / validate / QR commands
# ---------------------------------------------------------------------------

def list_dpp_files():
    print("\n  Existing DPP JSON files:")
    print("  " + "-" * 56)
    found = 0
    for f in sorted(OUTPUT_DIR.glob("*.json")):
        if f.name == "dpp-schema.json":
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            pid = data.get("passport_id", "?")
            name = data.get("product_name", "?")
            mfr = data.get("manufacturer", "?")
            print(f"  {f.name:<35} {pid:<30} {name} ({mfr})")
            found += 1
        except Exception:
            pass
    if not found:
        print("  No DPP files found.")
    print()


def validate_file(filepath: str):
    path = Path(filepath)
    if not path.exists():
        print(f"  [!] File not found: {filepath}")
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"  [!] Invalid JSON: {e}")
        return

    errors = validate_dpp_json(data)
    if errors:
        print(f"\n  Validation FAILED for {path.name}:")
        for e in errors:
            print(f"    - {e}")
    else:
        print(f"\n  [OK] {path.name} is valid DPP JSON")
        print(f"       Passport ID: {data.get('passport_id')}")
        print(f"       Product:     {data.get('product_name')}")
        print(f"       Standards:   {len(data.get('standards_compliance', []))} listed")
        props = data.get("technical_properties", {})
        print(f"       Properties:  {len(props)} technical parameters")


def generate_qr_for_file(filepath: str):
    path = Path(filepath)
    if not path.exists():
        print(f"  [!] File not found: {filepath}")
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    passport_id = data.get("passport_id", "UNKNOWN")
    verify_url = data.get("qr_verification", {}).get(
        "verification_url",
        f"{VERIFY_BASE_URL}/verify/{passport_id}",
    )
    qr_file = generate_qr_image(passport_id, verify_url, path)
    if qr_file:
        print(f"  [OK] QR code generated: {qr_file}")
        print(f"       Points to: {verify_url}")


def generate_all_qr():
    print("\n  Generating QR codes for all DPP files...")
    for f in sorted(OUTPUT_DIR.glob("*.json")):
        if f.name == "dpp-schema.json":
            continue
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            passport_id = data.get("passport_id")
            verify_url = data.get("qr_verification", {}).get("verification_url")
            if passport_id and verify_url:
                qr_file = generate_qr_image(passport_id, verify_url, f)
                if qr_file:
                    print(f"  [OK] {passport_id} -> {qr_file.name}")
        except Exception as e:
            print(f"  [!] {f.name}: {e}")
    print()


# ---------------------------------------------------------------------------
# Demo generation
# ---------------------------------------------------------------------------

DEMO_PRODUCTS = [
    {
        "product_name": "LATICRETE 335 Super Flex",
        "manufacturer": "LATICRETE International",
        "category": "Tile Adhesive",
        "description": "High-performance flexible thin-set adhesive for ceramic, porcelain, and natural stone tiles on floors and walls",
        "technical_properties": {
            "open_time": build_property(30, "minutes", "EN 1346"),
            "pot_life": build_property(4, "hours"),
            "tensile_adhesion_strength": build_property(1.5, "MPa", "EN 1348"),
            "slip_resistance": build_property("<0.5", "mm", "EN 1308"),
            "mixing_ratio": build_property("5.5-6.0", "litres per 20kg bag"),
            "coverage": build_property("3-5", "kg/m²", None),
            "bed_thickness": {"min": 3, "max": 10, "unit": "mm"},
        },
        "working_properties": {
            "working_time": build_property(30, "minutes", None),
            "foot_traffic": build_property(24, "hours"),
            "full_cure": build_property(28, "days"),
            "application_temperature": {"min": 5, "max": 35, "unit": "°C"},
        },
        "applications": ["Interior/exterior floor tiling", "Wall tiling", "Swimming pool tiling", "Heated floor systems"],
        "suitable_for": ["Commercial buildings", "Residential construction", "Wet areas and bathrooms", "External facades"],
        "standards": ["EN 12004 C2TES1", "ISO 13007", "ANSI A118.4ET", "ANSI A118.11"],
        "batch_number": "LAT-335-B2026-0801",
        "production_date": "2026-05-20",
        "origin_country": "USA",
        "factory_location": "Bethany, Connecticut",
        "recycled_content_pct": 5,
        "carbon_footprint_value": 0.45,
        "carbon_footprint_unit": "kgCO2e/kg",
        "packaging": "20 kg moisture-resistant paper bags on shrink-wrapped pallets",
        "storage": "Store in dry area between 5-35°C, away from moisture",
        "shelf_life_months": 12,
        "tds_title": "LATICRETE 335 Super Flex Thin-Set - TDS",
        "tds_revision": "Rev 8.2",
        "tds_date": "2025-03-01",
    },
    {
        "product_name": "Sika Grout 212",
        "manufacturer": "Sika India Pvt Ltd",
        "category": "Cementitious Grout",
        "description": "Non-shrink cementitious grout for precision equipment base-plating, anchor grouting, and structural repairs",
        "technical_properties": {
            "compressive_strength_1d": build_property(25, "MPa", "IS 516"),
            "compressive_strength_7d": build_property(45, "MPa", "IS 516"),
            "compressive_strength_28d": build_property(60, "MPa", "IS 516"),
            "flexural_strength_28d": build_property(8, "MPa", "IS 516"),
            "expansion": build_property("0.0-0.1", "%", "ASTM C827"),
            "flow_value": build_property(130, "%", "ASTM C230"),
            "density_fresh": build_property(2.2, "g/cm³"),
            "water_demand": build_property("3.0-3.5", "litres per 25kg bag"),
        },
        "working_properties": {
            "pot_life": build_property(30, "minutes", None),
            "initial_set": build_property(4, "hours", "IS 5513"),
            "final_set": build_property(6, "hours", "IS 5513"),
            "application_temperature": {"min": 10, "max": 40, "unit": "°C"},
            "minimum_section_thickness": build_property(10, "mm"),
            "maximum_section_thickness": build_property(100, "mm"),
        },
        "applications": ["Equipment base-plating", "Anchor bolt grouting", "Column jacketing", "Structural repairs"],
        "suitable_for": ["Bridge bearing pads", "Metro pier bases", "Industrial machine foundations", "Precast joint filling"],
        "standards": ["IS 516 - Compressive Strength", "ASTM C827 - Volume Change", "ASTM C230 - Flow Test", "IS 5513 - Setting Time", "EN 1504-6 - Grouting"],
        "batch_number": "SIKA-G212-IN-0622",
        "production_date": "2026-04-15",
        "origin_country": "India",
        "factory_location": "Goa, India",
        "recycled_content_pct": 8,
        "carbon_footprint_value": 0.52,
        "carbon_footprint_unit": "kgCO2e/kg",
        "packaging": "25 kg moisture-proof bags",
        "storage": "Store in dry conditions, off the ground, at 5-35°C",
        "shelf_life_months": 9,
        "tds_title": "Sika Grout 212 Non-Shrink Cementitious Grout - TDS",
        "tds_revision": "Rev 5.0",
        "tds_date": "2025-11-20",
    },
]


def run_demo():
    print("\n  Generating demo DPP files from sample TDS data...")
    print("  " + "-" * 50)
    for product in DEMO_PRODUCTS:
        dpp = build_dpp_json(**product)
        filename = re.sub(r"[^a-z0-9]+", "-", product["product_name"].lower()).strip("-") + ".json"
        filepath = OUTPUT_DIR / filename
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(dpp, f, indent=2, ensure_ascii=False)
        print(f"  [OK] {filepath.name}")
        print(f"       Passport: {dpp['passport_id']}")
        print(f"       Product:  {dpp['product_name']} ({dpp['manufacturer']})")

        qr_file = generate_qr_image(
            dpp["passport_id"],
            dpp["qr_verification"]["verification_url"],
            filepath,
        )
        if qr_file:
            print(f"       QR code:  {qr_file.name}")
        print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="TDS-to-JSON Digital Product Passport Converter",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tds_to_json_converter.py                     Interactive conversion
  python tds_to_json_converter.py --demo              Generate demo products
  python tds_to_json_converter.py --list              List existing DPP files
  python tds_to_json_converter.py --qr product.json   Generate QR for one file
  python tds_to_json_converter.py --qr-all            Generate QR for all files
  python tds_to_json_converter.py --validate file.json Validate DPP JSON
        """,
    )
    parser.add_argument("--demo", action="store_true", help="Generate demo DPP products")
    parser.add_argument("--list", action="store_true", help="List existing DPP files")
    parser.add_argument("--qr", metavar="FILE", help="Generate QR code for a DPP JSON file")
    parser.add_argument("--qr-all", action="store_true", help="Generate QR codes for all DPP files")
    parser.add_argument("--validate", metavar="FILE", help="Validate a DPP JSON file against schema")

    args = parser.parse_args()

    if args.demo:
        run_demo()
    elif args.list:
        list_dpp_files()
    elif args.qr:
        generate_qr_for_file(args.qr)
    elif args.qr_all:
        generate_all_qr()
    elif args.validate:
        validate_file(args.validate)
    else:
        interactive_convert()


if __name__ == "__main__":
    main()
