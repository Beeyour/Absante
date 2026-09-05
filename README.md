# Absante

نظام حضور للمحاضرات الجامعية: بوابة طالب عامة، ولوحة محاضر على مسار منفصل ومحمية بكلمة مرور.

## التشغيل المحلي

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# عدّل DOCTOR_PASSWORD و SECRET_KEY في .env

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

في طرفية ثانية:

```bash
cd frontend
npm install
npm run dev
```

- بوابة الطالب: http://127.0.0.1:5173/
- لوحة المحاضر: http://127.0.0.1:5173/doctor/login

Vite يوجّه طلبات `/api` إلى الخادم على المنفذ 8000، لذلك لا تُثبَّت `127.0.0.1` داخل الواجهة.

## الرفع على السيرفر

1. ضع قيم إنتاج في `.env` (`DOCTOR_PASSWORD`, `SECRET_KEY`, `APP_TIMEZONE`, وإن لزم `ALLOWED_ORIGINS`).
2. ابنِ الواجهة:

```bash
cd frontend
npm install
npm run build
```

3. شغّل الخادم من جذر المشروع. إذا وُجد `frontend/dist` يقدّم FastAPI الواجهة والـ API معاً على نفس النطاق:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

بعدها:

- الطالب: `https://your-domain/`
- المحاضر: `https://your-domain/doctor/login`
- الصحة: `https://your-domain/api/health`
- توثيق API: `https://your-domain/api/docs`

لا تضبط `VITE_API_BASE_URL` إذا كان الموقع والـ API على نفس النطاق. المسارات نسبية (`/api/...`) وتعمل بعد الرفع.

إذا فصلت الواجهة عن الخادم، ابنِ الواجهة مع:

```bash
VITE_API_BASE_URL=https://your-api-domain npm run build
```

وأضف أصل الواجهة إلى `ALLOWED_ORIGINS`.

خلف Nginx يمكن توجيه `/` و `/api` إلى نفس عملية uvicorn، أو توجيه `/api` إلى uvicorn والملفات الثابتة من `frontend/dist`.

## كلمة مرور المحاضر

الرابط `/doctor` وحده لا يكفي. الدخول يتطلب `DOCTOR_PASSWORD`. جلسة المحاضر رمز موقّع يُرسل في ترويسة `Authorization`.

## التوثيق للوكلاء

- المعمارية وعقد الـ API: `ARCHITECTURE.md`
- قواعد العمل للوكلاء: `AGENT_GUIDELINES.md` و `.cursorrules`

## الاختبارات

```bash
pytest
```
# Absante
