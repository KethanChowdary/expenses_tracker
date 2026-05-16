import csv, io, hashlib, re
from datetime import date, datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import sqlalchemy as sa
from app.database import get_db
from app.auth import get_current_user
from app.models import Transaction, TransactionType, User
from app.schemas import TransactionCreate

router = APIRouter(prefix="/imports", tags=["imports"])


class ImportCommitPayload(BaseModel):
    transactions: list[TransactionCreate] = Field(default_factory=list)


# ── amount / date parsers ───────────────────────────────────

def parse_amount(val: str) -> float:
    cleaned = re.sub(r"[₹$,\s]", "", str(val)).strip()
    # Handle trailing CR/DR markers: "1234.56CR" or "1234.56DR"
    cleaned = re.sub(r"(?i)(cr|dr)$", "", cleaned).strip()
    if not cleaned:
        return 0.0
    return float(cleaned)

def parse_date(val: str) -> date:
    val = str(val).strip()
    # Remove time portion if present: "01/04/2026 10:30:00" → "01/04/2026"
    val = val.split(" ")[0].split("T")[0]
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y",
                "%d %b %Y", "%Y/%m/%d", "%d-%b-%Y", "%b %d, %Y",
                "%d/%m/%y", "%d-%m-%y"):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {val!r}")

def row_fingerprint(row: dict) -> str:
    key = "|".join(f"{k}={row.get(k, '')}" for k in sorted(row.keys()))
    return hashlib.sha256(key.encode()).hexdigest()

def duplicate_query(
    db: Session,
    tx_date: date,
    amount: float,
    description: str,
    user_id: int,
    import_fingerprint: str | None = None,
):
    if import_fingerprint:
        fingerprint_match = db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.import_fingerprint == import_fingerprint,
        ).first()
        if fingerprint_match:
            return db.query(Transaction).filter(Transaction.id == fingerprint_match.id)

    description_filter = (
        sa.or_(Transaction.description == "", Transaction.description.is_(None))
        if description == ""
        else Transaction.description == description
    )
    return db.query(Transaction).filter(
        Transaction.user_id == user_id,
        Transaction.transaction_date == tx_date,
        Transaction.amount == amount,
        description_filter,
        Transaction.import_fingerprint.is_(None),
    )

def find_duplicate(
    db: Session,
    tx_date: date,
    amount: float,
    description: str,
    user_id: int,
    import_fingerprint: str | None = None,
):
    return duplicate_query(db, tx_date, amount, description, user_id, import_fingerprint).first()

def normalize_import_row(
    row: dict,
    *,
    amount_col: str = "",
    debit_col: str = "",
    credit_col: str = "",
    date_col: str = "",
    description_col: str = "",
    type_col: str = "",
    category_col: str = "",
    default_type: str = "expense",
    import_fingerprint: str | None = None,
) -> dict:
    raw_date = row.get(date_col, "").strip()
    if not raw_date:
        raise ValueError("Missing date")

    tx_date = parse_date(raw_date)

    if debit_col and credit_col:
        debit_raw = row.get(debit_col, "").strip()
        credit_raw = row.get(credit_col, "").strip()
        debit_val = parse_amount(debit_raw) if debit_raw else 0.0
        credit_val = parse_amount(credit_raw) if credit_raw else 0.0

        if credit_val > 0 and debit_val == 0:
            amount = credit_val
            tx_type = TransactionType.income
        elif debit_val > 0:
            amount = debit_val
            tx_type = TransactionType.expense
        else:
            raise ValueError("Ambiguous debit/credit row")
    else:
        raw_amount = row.get(amount_col, "").strip()
        if not raw_amount:
            raise ValueError("Missing amount")
        amount = abs(parse_amount(raw_amount))
        if amount == 0:
            raise ValueError("Zero amount")

        if type_col:
            type_raw = (row.get(type_col, "") or "").strip().lower()
            tx_type = TransactionType.income if type_raw in ("income", "credit", "cr", "dep") else TransactionType.expense
        else:
            tx_type = TransactionType.income if default_type.lower() == "income" else TransactionType.expense

    description = row.get(description_col, "").strip() if description_col else ""
    category = (row.get(category_col, "") or "").strip() if category_col else ""
    if not category:
        category = "Other"

    return {
        "amount": amount,
        "type": tx_type,
        "category": category,
        "merchant": description[:100] if description else None,
        "description": description[:255],
        "spend_kind": "regular",
        "lent_status": "none",
        "payment_mode": "account",
        "import_fingerprint": import_fingerprint,
        "source": "csv",
        "transaction_date": tx_date,
    }


# ── smart header detection ──────────────────────────────────

# Keywords that strongly suggest a row is a real table header
HEADER_KEYWORDS = {
    "date", "txn", "transaction", "value", "posted",
    "amount", "debit", "credit", "withdrawal", "deposit",
    "description", "narration", "particulars", "details", "remarks",
    "balance", "ref", "cheque", "chq", "type", "mode",
}

def _score_header_row(row: list) -> int:
    """Score a candidate row: higher = more likely to be a real header."""
    score = 0
    non_empty = [str(c).strip() for c in row if c is not None and str(c).strip()]
    if len(non_empty) < 2:
        return 0
    for cell in non_empty:
        words = re.split(r"[\s/\-_]+", cell.lower())
        for w in words:
            if w in HEADER_KEYWORDS:
                score += 3
    # Penalise rows that look like address / personal info
    joined = " ".join(non_empty).lower()
    if any(x in joined for x in ["@", "s/o", "d/o", "w/o", "village", "district", "pin"]):
        score -= 5
    return score


def _find_header_row(rows_raw: list[list]) -> int:
    """
    Returns the index of the best candidate header row.
    Looks at the first 30 rows and picks the one with the highest keyword score.
    Falls back to the first row with >= 2 non-empty cells.
    """
    best_idx, best_score = 0, -1
    fallback_idx = 0

    for i, row in enumerate(rows_raw[:30]):
        non_empty = [c for c in row if c is not None and str(c).strip()]
        if len(non_empty) < 2:
            continue
        if fallback_idx == 0 and len(non_empty) >= 2:
            fallback_idx = i  # first viable row

        score = _score_header_row(row)
        if score > best_score:
            best_score = score
            best_idx = i

    return best_idx if best_score > 0 else fallback_idx


# ── auto column mapping hints ───────────────────────────────

def _auto_map(headers: list[str]) -> dict:
    """
    Return suggested column mappings based on header names.
    Supports both:
      - single amount column  (amount_col)
      - split debit/credit    (debit_col + credit_col)
    """
    hints: dict = {
        "date_col": "",
        "amount_col": "",
        "debit_col": "",
        "credit_col": "",
        "description_col": "",
        "category_col": "",
        "type_col": "",
        "balance_col": "",
    }

    for h in headers:
        l = h.lower().strip()
        words = set(re.split(r"[\s/\-_]+", l))

        if not hints["date_col"] and words & {"date", "txndate", "valuedate", "posteddate", "transactiondate"}:
            hints["date_col"] = h
        if not hints["date_col"] and "date" in l:
            hints["date_col"] = h

        if not hints["debit_col"] and words & {"debit", "withdrawal", "dr", "paid", "spent"}:
            hints["debit_col"] = h
        if not hints["credit_col"] and words & {"credit", "deposit", "cr", "received"}:
            hints["credit_col"] = h

        # Single amount col (only if no split cols found yet or this is more specific)
        if not hints["amount_col"] and words & {"amount", "transactionamount"}:
            hints["amount_col"] = h

        if not hints["description_col"] and words & {"description", "narration", "particulars", "details", "remarks", "merchant"}:
            hints["description_col"] = h

        if not hints["category_col"] and "categ" in l:
            hints["category_col"] = h

        if not hints["type_col"] and words & {"type", "cr/dr", "drcrind", "txntype"}:
            hints["type_col"] = h

        if not hints["balance_col"] and "balance" in l:
            hints["balance_col"] = h

    # Decide mode: prefer split if both debit+credit found
    hints["mode"] = "split" if (hints["debit_col"] and hints["credit_col"]) else "single"

    return hints


# ── file readers ────────────────────────────────────────────

def read_csv(content: bytes) -> tuple[list[str], list[dict]]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])
    rows = [dict(r) for r in reader]
    return headers, rows


def read_xlsx(content: bytes) -> tuple[list[str], list[dict]]:
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
        rows_raw = [list(row) for row in ws.iter_rows(values_only=True)]
        if not rows_raw:
            return [], []

        header_idx = _find_header_row(rows_raw)
        headers = [
            str(c).strip() if c is not None and str(c).strip() else f"col_{i}"
            for i, c in enumerate(rows_raw[header_idx])
        ]

        rows = []
        for row in rows_raw[header_idx + 1:]:
            if all(c is None or str(c).strip() == "" for c in row):
                continue
            rows.append({
                headers[i]: (str(v).strip() if v is not None else "")
                for i, v in enumerate(row)
                if i < len(headers)
            })
        return headers, rows

    except Exception:
        pass

    # Fallback: xlrd for legacy .xls
    try:
        import xlrd
        wb = xlrd.open_workbook(file_contents=content)
        ws = wb.sheet_by_index(0)
        rows_raw = [
            [ws.cell_value(i, j) for j in range(ws.ncols)]
            for i in range(ws.nrows)
        ]
        header_idx = _find_header_row(rows_raw)
        headers = [
            str(ws.cell_value(header_idx, j)).strip() or f"col_{j}"
            for j in range(ws.ncols)
        ]
        rows = []
        for i in range(header_idx + 1, ws.nrows):
            row_vals = [ws.cell_value(i, j) for j in range(ws.ncols)]
            if all(str(v).strip() == "" for v in row_vals):
                continue
            rows.append({headers[j]: str(row_vals[j]).strip() for j in range(ws.ncols)})
        return headers, rows
    except Exception as e:
        raise ValueError(f"Cannot read Excel file: {e}")


def read_pdf(content: bytes) -> tuple[list[str], list[dict]]:
    import pdfplumber
    all_rows: list[dict] = []
    headers: list[str] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue
                if not headers:
                    # Find header row within first page's table
                    raw = [list(r) for r in table]
                    h_idx = _find_header_row(raw)
                    headers = [
                        str(c).strip() if c else f"col_{i}"
                        for i, c in enumerate(raw[h_idx])
                    ]
                    data_rows = raw[h_idx + 1:]
                else:
                    data_rows = list(table)
                for row in data_rows:
                    if all(c is None or str(c).strip() == "" for c in row):
                        continue
                    all_rows.append({
                        headers[i]: (str(v).strip() if v is not None else "")
                        for i, v in enumerate(row)
                        if i < len(headers)
                    })
    return headers, all_rows


# ── encryption helpers ──────────────────────────────────────

def decrypt_office(content: bytes, password: str) -> bytes:
    try:
        import msoffcrypto
    except ImportError:
        raise ValueError("msoffcrypto-tool not installed.")
    enc = io.BytesIO(content)
    office_file = msoffcrypto.OfficeFile(enc)
    office_file.load_key(password=password)
    dec = io.BytesIO()
    office_file.decrypt(dec)
    decrypted = dec.getvalue()
    if not decrypted:
        raise ValueError("Decryption produced empty file — wrong password?")
    return decrypted

def is_encrypted_ole(content: bytes) -> bool:
    if content[:8] != bytes([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]):
        return False
    return b"E\x00n\x00c\x00r\x00y\x00p\x00t\x00e\x00d\x00P\x00a\x00c\x00k\x00a\x00g\x00e\x00" in content

def parse_file(filename: str, content: bytes, password: str = "") -> tuple[list[str], list[dict]]:
    if is_encrypted_ole(content):
        if not password:
            raise ValueError("ENCRYPTED")
        content = decrypt_office(content, password)
        filename = filename.rsplit(".", 1)[0] + ".xlsx"

    ext = filename.rsplit(".", 1)[-1].lower()
    if ext in ("xlsx", "xls", "xlsm"):
        return read_xlsx(content)
    if ext == "pdf":
        return read_pdf(content)
    return read_csv(content)


# ── routes ─────────────────────────────────────────────────

@router.post("/preview")
async def preview_file(
    file: UploadFile = File(...),
    password: str = Form(""),
):
    content = await file.read()
    try:
        headers, rows = parse_file(file.filename or "file.csv", content, password)
    except ValueError as e:
        msg = str(e)
        if "ENCRYPTED" in msg:
            raise HTTPException(423, "ENCRYPTED")
        if "WRONG_PASSWORD" in msg or "wrong password" in msg.lower():
            raise HTTPException(401, "WRONG_PASSWORD")
        raise HTTPException(400, f"Could not parse file: {msg}")

    auto_map = _auto_map(headers)

    return {
        "headers": headers,
        "preview_rows": rows[:5],
        "auto_map": auto_map,          # ← new: suggested mappings for frontend
    }


@router.post("/review")
async def review_file(
    file: UploadFile = File(...),
    amount_col: str = Form(""),
    debit_col: str = Form(""),
    credit_col: str = Form(""),
    date_col: str = Form(""),
    description_col: str = Form(""),
    type_col: str = Form(""),
    category_col: str = Form(""),
    default_type: str = Form("expense"),
    password: str = Form(""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not date_col:
        raise HTTPException(400, "date_col is required")
    if not amount_col and not (debit_col and credit_col):
        raise HTTPException(400, "Either amount_col or both debit_col+credit_col are required")

    content = await file.read()
    try:
        _, rows = parse_file(file.filename or "file.csv", content, password)
    except ValueError as e:
        if "ENCRYPTED" in str(e):
            raise HTTPException(423, "ENCRYPTED")
        raise HTTPException(400, f"Could not parse file: {e}")

    reviewed = []
    seen_fingerprints: set[str] = set()
    errors = 0

    for index, row in enumerate(rows):
        try:
            fingerprint = row_fingerprint(row)
            tx = normalize_import_row(
                row,
                amount_col=amount_col,
                debit_col=debit_col,
                credit_col=credit_col,
                date_col=date_col,
                description_col=description_col,
                type_col=type_col,
                category_col=category_col,
                default_type=default_type,
                import_fingerprint=fingerprint,
            )
            duplicate = find_duplicate(
                db,
                tx["transaction_date"],
                tx["amount"],
                tx["description"] or "",
                user.id,
                fingerprint,
            )
            duplicate_in_file = fingerprint in seen_fingerprints
            seen_fingerprints.add(fingerprint)
            reviewed.append({
                "row_id": fingerprint + f"-{index}",
                "selected": not duplicate and not duplicate_in_file,
                "duplicate": bool(duplicate),
                "duplicate_in_file": duplicate_in_file,
                "existing": {
                    "id": duplicate.id,
                    "amount": duplicate.amount,
                    "type": duplicate.type,
                    "category": duplicate.category,
                    "merchant": duplicate.merchant,
                    "description": duplicate.description,
                    "reason": duplicate.reason,
                    "transaction_date": duplicate.transaction_date,
                } if duplicate else None,
                "transaction": {
                    **tx,
                    "type": tx["type"].value,
                    "transaction_date": tx["transaction_date"].isoformat(),
                },
            })
        except Exception:
            errors += 1

    return {
        "rows": reviewed,
        "duplicates": sum(1 for row in reviewed if row["duplicate"] or row["duplicate_in_file"]),
        "errors": errors,
    }


@router.post("/commit")
async def commit_import(
    payload: ImportCommitPayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    imported = skipped = errors = 0
    seen_fingerprints: set[str] = set()

    for tx_payload in payload.transactions:
        try:
            tx_data = tx_payload.model_dump()
            tx_date = tx_data["transaction_date"]
            amount = tx_data["amount"]
            description = tx_data.get("description") or ""
            fingerprint = tx_data.get("import_fingerprint")

            if fingerprint and fingerprint in seen_fingerprints:
                skipped += 1
                continue

            if find_duplicate(db, tx_date, amount, description, user.id, fingerprint):
                skipped += 1
                continue

            if fingerprint:
                seen_fingerprints.add(fingerprint)
            tx_data["source"] = tx_data.get("source") or "csv"
            tx_data["user_id"] = user.id
            db.add(Transaction(**tx_data))
            imported += 1
        except Exception:
            errors += 1

    db.commit()
    return {"imported": imported, "skipped": skipped, "errors": errors}


@router.post("/import")
async def import_file(
    file: UploadFile = File(...),
    # Single-amount mode
    amount_col: str = Form(""),
    # Split debit/credit mode
    debit_col: str = Form(""),
    credit_col: str = Form(""),
    # Common fields
    date_col: str = Form(""),
    description_col: str = Form(""),
    type_col: str = Form(""),
    category_col: str = Form(""),
    default_type: str = Form("expense"),
    password: str = Form(""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not date_col:
        raise HTTPException(400, "date_col is required")
    if not amount_col and not (debit_col and credit_col):
        raise HTTPException(400, "Either amount_col or both debit_col+credit_col are required")

    content = await file.read()
    try:
        _, rows = parse_file(file.filename or "file.csv", content, password)
    except ValueError as e:
        if "ENCRYPTED" in str(e):
            raise HTTPException(423, "ENCRYPTED")
        raise HTTPException(400, f"Could not parse file: {e}")

    imported = skipped = errors = 0

    for row in rows:
        try:
            fingerprint = row_fingerprint(row)
            tx = normalize_import_row(
                row,
                amount_col=amount_col,
                debit_col=debit_col,
                credit_col=credit_col,
                date_col=date_col,
                description_col=description_col,
                type_col=type_col,
                category_col=category_col,
                default_type=default_type,
                import_fingerprint=fingerprint,
            )

            if find_duplicate(db, tx["transaction_date"], tx["amount"], tx["description"] or "", user.id, fingerprint):
                skipped += 1
                continue

            db.add(Transaction(**tx, user_id=user.id))
            imported += 1

        except Exception:
            errors += 1

    db.commit()
    return {"imported": imported, "skipped": skipped, "errors": errors}
