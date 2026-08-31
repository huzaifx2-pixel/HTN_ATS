"""
Optional pyresparser sidecar for Headsbase ATS.
Wraps https://github.com/OmkarPathak/pyresparser

Setup:
  cd services/pyresparser-server
  python -m venv .venv
  .venv\\Scripts\\activate        # Windows
  pip install -r requirements.txt
  python -m spacy download en_core_web_sm
  python -m nltk.downloader stopwords words
  uvicorn app:app --host 127.0.0.1 --port 8001

Then in .env:
  RESUME_PARSER_PROVIDER=pyresparser
  RESUME_PARSER_URL=http://127.0.0.1:8001
"""
import os
import tempfile

from fastapi import FastAPI, File, UploadFile, HTTPException
from pyresparser import ResumeParser

app = FastAPI(title="Headsbase pyresparser sidecar")


@app.get("/health")
def health():
    return {"status": "ok", "parser": "pyresparser"}


@app.post("/parse")
async def parse_resume(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename")

    ext = os.path.splitext(file.filename)[1] or ".pdf"
    content = await file.read()

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        data = ResumeParser(tmp_path).get_extracted_data()
        return data
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        os.unlink(tmp_path)
