

frontend:
	cd frontend
	npm install
	npm run build





backend:
	uvicorn app.main:app --host 127.0.0.1 --port 8000