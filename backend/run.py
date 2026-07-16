"""
Simple entry point — run with: python run.py
Starts the SpeakWell FastAPI backend on http://localhost:8000
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
